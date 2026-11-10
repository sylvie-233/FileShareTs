import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { env } from './config/env.js';
import { resolveFromBase } from './core/paths.js';
import { loadStaticAsset } from './core/static.js';
import { errorHandler } from './middleware/error.js';
import { createApiRoutes } from './routes/index.js';
import type { AppEnv } from './types/context.js';

export interface AppOptions {
  /** 静态资源目录，默认按进程工作目录解析。 */
  staticDir?: string;
}

export function createApp(options: AppOptions = {}): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  const staticDir = options.staticDir ?? resolveFromBase('static');

  if (env.NODE_ENV !== 'test') {
    app.use('*', logger());
  }

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Disposition', 'Content-Length'],
      maxAge: 86_400,
    }),
  );

  /** 健康检查：便于容器与局域网探活。 */
  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.route('/api', createApiRoutes());

  app.get('/', async (c) => {
    const asset = await loadStaticAsset('index.html', staticDir);
    if (!asset) {
      return c.text('Not Found', 404);
    }
    return c.body(asset.body, 200, { 'Content-Type': asset.contentType });
  });

  app.get('/static/*', async (c) => {
    const prefix = '/static/';
    const relativePath = c.req.path.slice(prefix.length);

    let decoded: string;
    try {
      decoded = decodeURIComponent(relativePath);
    } catch {
      return c.text('Not Found', 404);
    }

    const asset = await loadStaticAsset(decoded, staticDir);
    if (!asset) {
      return c.text('Not Found', 404);
    }

    return c.body(asset.body, 200, {
      'Content-Type': asset.contentType,
      'Cache-Control': 'public, max-age=3600',
    });
  });

  app.notFound((c) => c.json({ detail: 'Not Found' }, 404));
  app.onError(errorHandler);

  return app;
}
