const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 按东八区格式化日期，offsetDays 可为负值。 */
export function formatDate(date = new Date(), offsetDays = 0): string {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** 按东八区格式化为 MySQL DATETIME 字符串。 */
export function formatDateTime(date = new Date(), offsetDays = 0): string {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS + offsetDays * 86_400_000);
  const iso = shifted.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/** N 天前的 DATETIME 字符串。 */
export function daysAgo(days: number): string {
  return formatDateTime(new Date(), -days);
}
