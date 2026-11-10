import { Scalar } from '@scalar/hono-api-reference';

import { env } from '../config/env.js';
import { createApiRouter } from '../openapi/router.js';
import { createFilesRouter } from './files.js';

/** 组装 /api 下的业务路由、OpenAPI JSON 与 Scalar API 文档。 */
export function createApiRoutes() {
  const router = createApiRouter();

  router.route('/v1', createFilesRouter());

  router.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: `${env.PROJECT_NAME} API`,
      version: env.VERSION,
      description: [
        '局域网文件共享服务 API。',
        '',
        '业务接口前缀为 `/api/v1`；错误响应统一为 `{ "detail": "错误信息" }`。',
      ].join('\n'),
    },
    servers: [{ url: env.API_V1_PREFIX, description: '当前服务' }],
    tags: [
      { name: '服务', description: '服务器信息与局域网访问地址' },
      { name: '文件', description: '文件上传、列表、下载与删除' },
    ],
  });

  router.get(
    '/docs',
    Scalar({
      url: '/api/openapi.json',
      pageTitle: `${env.PROJECT_NAME} API 文档`,
    }),
  );

  return router;
}
