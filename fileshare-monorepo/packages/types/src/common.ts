/** 服务端错误响应（与 FastAPI 的 `detail` 字段保持一致）。 */
export interface ErrorResponse {
  detail: string;
}

/** 分页结果。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页查询参数。 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}
