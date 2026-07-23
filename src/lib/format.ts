export function yen(n: number): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

export function signedYen(n: number): string {
  return (n >= 0 ? '+' : '−') + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP');
}

/** "YYYY-MM" → "2026年7月" */
export function ymLabel(ym: string): string {
  return `${ym.slice(0, 4)}年${parseInt(ym.slice(5), 10)}月`;
}

export function dateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${youbi})`;
}
