import { createWriteStream } from 'node:fs';
import { access, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { FileInfo } from '@fileshare/types';

import { HttpError } from '../utils/http.js';

/** 上传目录，由 initFileService 在启动时配置。 */
let uploadDir: string | null = null;

function requireUploadDir(): string {
  if (!uploadDir) {
    throw new Error('文件服务尚未初始化，请先调用 initFileService');
  }
  return uploadDir;
}

/** 只保留文件名本身，拒绝路径分隔符与空名，避免目录穿越。 */
export function safeFilename(raw: string): string {
  const name = basename(raw.replace(/\\/g, '/')).normalize('NFC').trim();
  if (!name || name === '.' || name === '..' || name.includes('\0')) {
    throw new HttpError(400, '文件名不合法');
  }
  if (name.length > 255) {
    throw new HttpError(400, '文件名过长');
  }
  return name;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface FilePathInfo {
  name: string;
  path: string;
  size: number;
}

/** 初始化文件服务：创建并记录上传目录。 */
export async function initFileService(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  uploadDir = dir;
}

/** 将上传流写入临时文件，完成后原子重命名为目标文件。 */
export async function saveFile(rawName: string, source: Readable): Promise<string> {
  const dir = requireUploadDir();
  const name = safeFilename(rawName);
  const target = join(dir, name);

  if (await fileExists(target)) {
    throw new HttpError(400, '文件已存在');
  }

  const temp = `${target}.${process.pid}.${Date.now()}.part`;
  try {
    await pipeline(source, createWriteStream(temp, { flags: 'wx' }));
    await rename(temp, target);
    return name;
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw new HttpError(500, `文件保存失败: ${(error as Error).message}`);
  }
}

/** 获取上传目录下的文件列表。 */
export async function listFiles(): Promise<FileInfo[]> {
  const dir = requireUploadDir();
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry): Promise<FileInfo | null> => {
        try {
          const info = await stat(join(dir, entry.name));
          return {
            name: entry.name,
            size: info.size,
            // 与原 Python 版本一致：mtime 使用 Unix 秒（含小数）
            modified: info.mtimeMs / 1000,
          };
        } catch {
          // 文件在遍历过程中被删除，忽略即可
          return null;
        }
      }),
  );

  return files.filter((file): file is FileInfo => file !== null);
}

/** 解析单个文件路径，不存在时抛 404。 */
export async function getFile(rawName: string): Promise<FilePathInfo> {
  const dir = requireUploadDir();
  const name = safeFilename(rawName);
  const filePath = join(dir, name);

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new HttpError(404, '文件不存在');
    }
    return { name, path: filePath, size: info.size };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(404, '文件不存在');
  }
}

/** 删除单个文件，返回实际删除的文件名。 */
export async function deleteFile(rawName: string): Promise<string> {
  const file = await getFile(rawName);

  try {
    await unlink(file.path);
    return file.name;
  } catch (error) {
    throw new HttpError(500, `文件删除失败: ${(error as Error).message}`);
  }
}

/** 清空上传目录中的全部文件，返回删除数量。 */
export async function clearAllFiles(): Promise<number> {
  const dir = requireUploadDir();
  let count = 0;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      await unlink(join(dir, entry.name));
      count += 1;
    }
    return count;
  } catch (error) {
    throw new HttpError(500, `清空文件失败: ${(error as Error).message}`);
  }
}
