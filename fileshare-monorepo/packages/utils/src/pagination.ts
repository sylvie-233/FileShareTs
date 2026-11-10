import type { PageResult } from '@fileshare/types';

export interface PageInput {
  page?: number;
  pageSize?: number;
}

/** 分页参数归一化：页码最小 1，单页最大 100。 */
export function normalizePagination(
  query: PageInput,
  defaultPageSize = 10,
): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? defaultPageSize)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** 构造统一分页响应。 */
export function paginate<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResult<T> {
  return { list, total, page, pageSize };
}
