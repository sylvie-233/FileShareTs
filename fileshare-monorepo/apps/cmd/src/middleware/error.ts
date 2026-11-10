import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { HttpError } from '../utils/http.js';

/**
 * 全局错误处理：保持与原 FastAPI 版本一致的 { detail } 响应结构，
 * 同时避免把堆栈等内部信息泄露给客户端。
 */
export function errorHandler(error: Error, c: Context): Response {
  if (error instanceof HttpError) {
    return c.json({ detail: error.message }, error.status);
  }

  if (error instanceof HTTPException) {
    return c.json({ detail: error.message || '请求处理失败' }, error.status);
  }

  console.error('[cmd:error]', error);
  return c.json({ detail: '服务器内部错误' }, 500);
}
