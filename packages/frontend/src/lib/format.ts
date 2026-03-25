/** Shared formatting utilities */

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
