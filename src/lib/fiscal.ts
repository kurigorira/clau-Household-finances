// 4月始まりの年度計算ユーティリティ

/** 日付(YYYY-MM-DD or Date)が属する年度を返す。例: 2026-04-01〜2027-03-31 → 2026 */
export function fiscalYearOf(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 4 ? y : y - 1;
}

/** 年度の12ヶ月分の "YYYY-MM" 配列 (4月〜翌3月) */
export function fiscalMonths(fiscalYear: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1; // 4,5,...,12,1,2,3
    const y = m >= 4 ? fiscalYear : fiscalYear + 1;
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

/** "YYYY-MM" の月ラベル (例: "4月") */
export function monthLabel(ym: string): string {
  return `${parseInt(ym.slice(5), 10)}月`;
}

export function ymOf(date: string): string {
  return date.slice(0, 7);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function thisMonth(): string {
  return today().slice(0, 7);
}

/** "YYYY-MM" に months ヶ月足す */
export function addMonths(ym: string, months: number): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(5), 10) - 1 + months;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, '0')}`;
}

/** 月の日数 */
export function daysInMonth(ym: string): number {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(5), 10);
  return new Date(y, m, 0).getDate();
}

/** 月内の日を実在する日にクランプして "YYYY-MM-DD" を返す (31 → 2月なら28/29日) */
export function clampDate(ym: string, day: number): string {
  const d = Math.min(day, daysInMonth(ym));
  return `${ym}-${String(d).padStart(2, '0')}`;
}
