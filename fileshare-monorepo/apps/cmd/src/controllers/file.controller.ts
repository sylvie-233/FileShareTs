import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import Busboy from 'busboy';

import { env } from '../config/env.js';
import { getLogger } from '../core/logger.js';
import * as fileService from '../services/file.service.js';
import type { AppContext } from '../types/context.js';
import { HttpError } from '../utils/http.js';
import { getLocalIp } from '../utils/network.js';

const logger = getLogger('file');

/** 路径参数可能已被 Hono 解码，解码失败时按原值使用。 */
function decodeFilename(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 生成兼容中文文件名的 Content-Disposition。 */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * 流式接收 multipart 上传。
 * 使用 busboy 直接写入磁盘，避免像 parseBody 那样把整个文件读进内存。
 * 注意：上传路由刻意不声明 request.body，否则 OpenAPI 校验会缓冲整个文件。
 */
function receiveUpload(c: AppContext, maxFileSize: number): Promise<string> {
  const rawBody = c.req.raw.body;
  if (!rawBody) {
    return Promise.reject(new HttpError(400, '未接收到上传内容'));
  }

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return Promise.reject(new HttpError(400, '请求格式必须为 multipart/form-data'));
  }

  return new Promise<string>((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: Object.fromEntries(c.req.raw.headers) as Record<string, string | undefined>,
        limits: { fileSize: maxFileSize, files: 1 },
        // multipart 头中的文件名按 UTF-8 解码，兼容中文文件名
        defParamCharset: 'utf8',
      });
    } catch (error) {
      reject(new HttpError(400, `无法解析上传请求: ${(error as Error).message}`));
      return;
    }

    let saved: Promise<string> | null = null;
    let oversize = false;

    parser.on('file', (field, stream, info) => {
      if (field !== 'file' || saved) {
        // 只接受一个名为 file 的字段，其余内容消费掉以便解析继续
        stream.resume();
        return;
      }

      stream.on('limit', () => {
        oversize = true;
      });

      const promise = fileService.saveFile(info.filename ?? '', stream);
      saved = promise;

      // 校验失败时流可能尚未被消费，主动 resume 避免 busboy 停滞
      promise.catch(() => {
        stream.resume();
      });
    });

    parser.on('error', (error: Error) => {
      reject(new HttpError(400, `文件上传失败: ${error.message}`));
    });

    parser.on('close', () => {
      void (async () => {
        try {
          if (!saved) {
            throw new HttpError(400, '未提供文件');
          }

          const name = await saved;
          if (oversize) {
            await fileService.deleteFile(name).catch(() => undefined);
            throw new HttpError(413, '文件大小超过限制');
          }

          resolve(name);
        } catch (error) {
          reject(error instanceof Error ? error : new HttpError(500, '文件上传失败'));
        }
      })();
    });

    const source = Readable.fromWeb(rawBody as unknown as WebReadableStream<Uint8Array>);
    source.on('error', (error) => {
      reject(new HttpError(400, `读取上传内容失败: ${error.message}`));
    });
    source.pipe(parser);
  });
}

/** GET /api/v1/server-info */
export async function getServerInfo(c: AppContext): Promise<Response> {
  const localIp = await getLocalIp();
  const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const scheme = forwardedProto || new URL(c.req.url).protocol.replace(':', '');

  return c.json({ server_url: `${scheme}://${localIp}:${env.PORT}` }, 200);
}

/** POST /api/v1/upload */
export async function uploadFile(c: AppContext): Promise<Response> {
  logger.info('收到上传请求');
  const filename = await receiveUpload(c, env.MAX_FILE_SIZE);
  logger.info(`文件上传成功: ${filename}`);

  return c.json({ filename, status: 'success' as const }, 200);
}

/** GET /api/v1/files */
export async function listFiles(c: AppContext): Promise<Response> {
  const files = await fileService.listFiles();
  logger.info(`获取到 ${files.length} 个文件`);

  return c.json({ files }, 200);
}

/** GET /api/v1/download/{filename} */
export async function downloadFile(c: AppContext): Promise<Response> {
  const filename = decodeFilename(c.req.param('filename') ?? '');
  const file = await fileService.getFile(filename);
  logger.info(`下载文件: ${file.name}`);

  const stream = createReadStream(file.path);
  return c.body(Readable.toWeb(stream) as unknown as ReadableStream, 200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(file.size),
    'Content-Disposition': contentDisposition(file.name),
  });
}

/** DELETE /api/v1/files/{filename} */
export async function deleteFile(c: AppContext): Promise<Response> {
  const filename = decodeFilename(c.req.param('filename') ?? '');
  const deletedFilename = await fileService.deleteFile(filename);
  logger.info(`文件删除成功: ${deletedFilename}`);

  return c.json({ status: 'success' as const, filename: deletedFilename }, 200);
}

/** DELETE /api/v1/files */
export async function clearFiles(c: AppContext): Promise<Response> {
  const count = await fileService.clearAllFiles();
  logger.info(`清空成功，删除了 ${count} 个文件`);

  return c.json({ status: 'success' as const, count }, 200);
}
