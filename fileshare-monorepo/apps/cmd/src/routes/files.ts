import { createRoute, z } from '@hono/zod-openapi';

import * as fileController from '../controllers/file.controller.js';
import {
  ClearAllResponseSchema,
  DeleteResponseSchema,
  FileListResponseSchema,
  ServerInfoResponseSchema,
  UploadResponseSchema,
  errorResponses,
  filenameParamsSchema,
  successResponse,
} from '../openapi/models.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';

export function createFilesRouter() {
  const router = createApiRouter();

  const serverInfoRoute = createRoute({
    method: 'get',
    path: '/server-info',
    tags: ['服务'],
    summary: '获取服务器访问地址',
    description: '返回本机在局域网中的 IP 与当前服务端口，用于生成分享链接和二维码。',
    responses: {
      200: successResponse(ServerInfoResponseSchema, '服务器信息'),
      ...errorResponses,
    },
  });

  const uploadRoute = createRoute({
    method: 'post',
    path: '/upload',
    tags: ['文件'],
    summary: '上传文件',
    description: [
      '使用 `multipart/form-data` 提交，字段名为 `file`。',
      '',
      '服务端通过 busboy 流式写入磁盘，不会把整个文件加载进内存；',
      '同名文件返回 400，超过 `MAX_FILE_SIZE` 返回 413。',
    ].join('\n'),
    responses: {
      200: successResponse(UploadResponseSchema, '上传成功'),
      ...errorResponses,
    },
  });

  const listRoute = createRoute({
    method: 'get',
    path: '/files',
    tags: ['文件'],
    summary: '获取文件列表',
    responses: {
      200: successResponse(FileListResponseSchema, '文件列表'),
      ...errorResponses,
    },
  });

  const downloadRoute = createRoute({
    method: 'get',
    path: '/download/{filename}',
    tags: ['文件'],
    summary: '下载文件',
    request: { params: filenameParamsSchema },
    responses: {
      200: {
        description: '文件二进制内容',
        content: {
          'application/octet-stream': {
            schema: z.string().openapi({ format: 'binary' }),
          },
        },
      },
      ...errorResponses,
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/files/{filename}',
    tags: ['文件'],
    summary: '删除单个文件',
    request: { params: filenameParamsSchema },
    responses: {
      200: successResponse(DeleteResponseSchema, '删除成功'),
      ...errorResponses,
    },
  });

  const clearRoute = createRoute({
    method: 'delete',
    path: '/files',
    tags: ['文件'],
    summary: '清空全部文件',
    responses: {
      200: successResponse(ClearAllResponseSchema, '清空成功'),
      ...errorResponses,
    },
  });

  router.openapi(serverInfoRoute, routeHandler(fileController.getServerInfo));
  router.openapi(uploadRoute, routeHandler(fileController.uploadFile));
  router.openapi(listRoute, routeHandler(fileController.listFiles));
  router.openapi(downloadRoute, routeHandler(fileController.downloadFile));
  router.openapi(deleteRoute, routeHandler(fileController.deleteFile));
  router.openapi(clearRoute, routeHandler(fileController.clearFiles));

  return router;
}
