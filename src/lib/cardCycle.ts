import type { Card } from '../db/schema';
import { addMonths, clampDate, daysInMonth, ymOf } from './fiscal';

// カードの締め日・支払日サイクルの計算。
// closingDay: 締め日 (31 = 月末扱い)。利用日が締め日以前ならその月締め、以降なら翌月締め。
// paymentMonthOffset: 締め月から引落月までの月数 (通常 1 = 翌月)。

/** 利用日からその利用が属する「締め月」(YYYY-MM) を返す */
export function closingMonthOf(card: Card, useDate: string): string {
  const ym = ymOf(useDate);
  const day = parseInt(useDate.slice(8), 10);
  const closing = Math.min(card.closingDay, daysInMonth(ym));
  return day <= closing ? ym : addMonths(ym, 1);
}

/** 締め月に対する引落日 (YYYY-MM-DD) */
export function paymentDateOf(card: Card, closingMonth: string): string {
  const payMonth = addMonths(closingMonth, card.paymentMonthOffset);
  return clampDate(payMonth, card.paymentDay);
}

/** 利用日 → 引落日 */
export function paymentDateForUse(card: Card, useDate: string): string {
  return paymentDateOf(card, closingMonthOf(card, useDate));
}

/** 締め月に含まれる利用日の範囲 [from, to] (両端含む) */
export function usePeriodOfClosingMonth(card: Card, closingMonth: string): { from: string; to: string } {
  const closing = Math.min(card.closingDay, daysInMonth(closingMonth));
  const to = clampDate(closingMonth, closing);
  const prev = addMonths(closingMonth, -1);
  const prevClosing = Math.min(card.closingDay, daysInMonth(prev));
  const fromDate = new Date(clampDate(prev, prevClosing) + 'T00:00:00');
  fromDate.setDate(fromDate.getDate() + 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
  return { from, to };
}

/** 基準日時点でまだ締まっていない「現在の締め期間」の締め月 */
export function currentClosingMonth(card: Card, baseDate: string): string {
  return closingMonthOf(card, baseDate);
}
