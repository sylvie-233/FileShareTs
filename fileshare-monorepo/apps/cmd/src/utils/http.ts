import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** 业务错误：由全局错误处理转换为客户端可读的 JSON 响应。 */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(status: ContentfulStatusCode, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
