/** 生成 IN (?, ?, ...) 占位符。 */
export function placeholders(length: number): string {
  return Array.from({ length }, () => '?').join(', ');
}

/** 转义 SQL LIKE 中的通配符，避免用户输入 % / _ 造成全表匹配。 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
