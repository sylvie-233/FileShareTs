/** 按 RFC 4180 转义单个 CSV 单元格。 */
export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 将表头与数据行拼接为 CSV 文本（不含 BOM，由调用方按需添加）。 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}
