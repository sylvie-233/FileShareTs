import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { getSea } from './sea.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);

export interface StaticAsset {
  body: string | ArrayBuffer;
  contentType: string;
}

/**
 * 读取静态资源。
 * 打包后从 SEA 内嵌资源读取，开发时从磁盘读取。
 * 返回 null 表示资源不存在或路径不合法。
 */
export async function loadStaticAsset(
  relativePath: string,
  staticDir: string,
): Promise<StaticAsset | null> {
  const rel = relativePath.replace(/^\/+/, '');
  const segments = rel.split('/');
  if (!rel || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }

  const extension = extname(rel).toLowerCase();
  const contentType = MIME_TYPES[extension] ?? 'application/octet-stream';

  const sea = getSea();
  if (sea?.isSea()) {
    try {
      return { body: sea.getAsset(`static/${rel}`), contentType };
    } catch {
      return null;
    }
  }

  const root = resolve(staticDir);
  const target = resolve(root, rel);
  if (target !== root && !target.startsWith(root + sep)) {
    return null;
  }

  try {
    const buffer = await readFile(target);
    if (TEXT_EXTENSIONS.has(extension)) {
      return { body: buffer.toString('utf8'), contentType };
    }
    return {
      body: buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
      contentType,
    };
  } catch {
    return null;
  }
}
