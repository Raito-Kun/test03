/** Shared formatting utilities */

/** Add leading 0 for Vietnamese phone numbers (9xxxxxxxx → 09xxxxxxxx) */
export function fmtPhone(num?: string): string {
  if (!num) return '';
  if (/^\d{9,10}$/.test(num) && !num.startsWith('0')) return `0${num}`;
  return num;
}

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

/** Check if agent can make calls. Returns error message or null if OK. */
export function checkCallBlocked(myStatus: string, sipExtension?: string | null): string | null {
  if (!sipExtension) return 'Tài khoản chưa được cấu hình số máy lẻ (SIP extension)';
  if (myStatus === 'offline' || myStatus === 'break') return 'Bạn cần chuyển sang trạng thái Sẵn sàng để thực hiện cuộc gọi';
  return null;
}
