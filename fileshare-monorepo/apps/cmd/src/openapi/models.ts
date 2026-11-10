import { z } from '@hono/zod-openapi';

/**
 * OpenAPI 响应模型。
 * 本文件只负责「接口返回什么」，与实际 types 包中的 DTO 保持一致。
 */

/* ========================= 通用 ========================= */

/** 错误响应（与原 FastAPI 的 { detail } 保持一致）。 */
export const ErrorResponseSchema = z
  .object({
    detail: z.string().openapi({ example: '文件不存在' }),
  })
  .openapi('ErrorResponse');

/** 构造 JSON 内容对象。 */
export function jsonContent<T extends z.ZodTypeAny>(schema: T) {
  return { 'application/json': { schema } };
}

/** 构造 200 成功响应。 */
export function successResponse<T extends z.ZodTypeAny>(data: T, description = '成功') {
  return {
    content: jsonContent(data),
    description,
  };
}

/** 通用错误响应：所有接口都可能返回。 */
export const errorResponses = {
  400: {
    content: jsonContent(ErrorResponseSchema),
    description: '请求参数错误',
  },
  404: {
    content: jsonContent(ErrorResponseSchema),
    description: '资源不存在',
  },
  413: {
    content: jsonContent(ErrorResponseSchema),
    description: '文件大小超过限制',
  },
  500: {
    content: jsonContent(ErrorResponseSchema),
    description: '服务器内部错误',
  },
};

/* ========================= 路径参数 ========================= */

/** 路径参数 `{filename}`。 */
export const filenameParamsSchema = z.object({
  filename: z
    .string()
    .min(1)
    .openapi({
      param: { name: 'filename', in: 'path' },
      description: '文件名（需要 URL 编码）',
      example: 'report.pdf',
    }),
});

/* ========================= 文件模型 ========================= */

/** 上传目录中的单个文件。 */
export const FileInfoSchema = z
  .object({
    name: z.string().openapi({ example: 'report.pdf' }),
    size: z
      .number()
      .int()
      .nonnegative()
      .openapi({ description: '文件大小（字节）', example: 1024 }),
    modified: z.number().openapi({
      description: '最后修改时间（Unix 秒，含小数）',
      example: 1760000000.5,
    }),
  })
  .openapi('FileInfo');

/** GET /api/v1/files */
export const FileListResponseSchema = z
  .object({
    files: z.array(FileInfoSchema),
  })
  .openapi('FileListResponse');

/** POST /api/v1/upload */
export const UploadResponseSchema = z
  .object({
    filename: z.string().openapi({ example: 'report.pdf' }),
    status: z.literal('success'),
  })
  .openapi('UploadResponse');

/** DELETE /api/v1/files/{filename} */
export const DeleteResponseSchema = z
  .object({
    status: z.literal('success'),
    filename: z.string().openapi({ example: 'report.pdf' }),
  })
  .openapi('DeleteResponse');

/** DELETE /api/v1/files */
export const ClearAllResponseSchema = z
  .object({
    status: z.literal('success'),
    count: z.number().int().nonnegative().openapi({ example: 3 }),
  })
  .openapi('ClearAllResponse');

/** GET /api/v1/server-info */
export const ServerInfoResponseSchema = z
  .object({
    server_url: z.string().openapi({ example: 'http://192.168.1.100:8000' }),
  })
  .openapi('ServerInfoResponse');
