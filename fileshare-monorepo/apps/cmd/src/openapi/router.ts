import { OpenAPIHono } from '@hono/zod-openapi';
import type { Handler } from 'hono';

import type { AppContext, AppEnv } from '../types/context.js';
import { formatZodError } from '../utils/validate.js';

/**
 * 创建支持 OpenAPI 的路由实例。
 * Zod 校验失败统一转换为 { detail } 结构，与原 FastAPI 版本的错误响应保持一致。
 */
export function createApiRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ detail: formatZodError(result.error) }, 400);
      }
    },
  });
}

/**
 * 控制器统一返回原生 Response，这里放宽为 Hono Handler 类型，
 * 避免 OpenAPI 路由因响应类型推断而互相约束。
 */
export function routeHandler(
  handler: (c: AppContext) => Promise<Response> | Response,
): Handler<AppEnv> {
  return handler as Handler<AppEnv>;
}
