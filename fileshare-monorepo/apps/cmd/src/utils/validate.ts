import type { ZodError } from 'zod';

/** 将 Zod 错误压缩为一条中文提示。 */
export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return '参数校验失败';
  }
  const path = issue.path.join('.');
  return path ? `${path}：${issue.message}` : issue.message;
}
