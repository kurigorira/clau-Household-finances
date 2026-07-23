import type { Card, RecurringItem, Transaction } from '../db/schema';
import { addMonths, thisMonth, ymOf } from './fiscal';
import { closingMonthOf, paymentDateOf } from './cardCycle';

export interface MonthForecast {
  month: string; // YYYY-MM
  income: number;
  fixedExpense: number; // 固定費 (recurring)
  cardPayment: number; // カード引落 (確定分 + 平均による予測分)
  variableExpense: number; // 変動費予測 (現金・口座払いの平均)
  net: number;
  balance: number; // 予測残高
  confirmedCard: boolean; // カード分が実績ベースで確定しているか
}

function monthMatches(item: RecurringItem, ym: string): boolean {
  if (!item.active) return false;
  if (!item.months || item.months.length === 0) return true;
  return item.months.includes(parseInt(ym.slice(5), 10));
}

/** 月ごとの固定収入・固定支出 */
export function recurringTotals(items: RecurringItem[], ym: string): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const it of items) {
    if (!monthMatches(it, ym)) continue;
    if (it.kind === 'income') income += it.amount;
    else expense += it.amount;
  }
  return { income, expense };
}

/** カードごとの締め月別利用額 (記帳済みトランザクションから) */
export function cardUsageByClosingMonth(cards: Card[], txs: Transaction[]): Map<number, Map<string, number>> {
  const byCard = new Map<number, Map<string, number>>();
  for (const card of cards) {
    if (card.id == null) continue;
    byCard.set(card.id, new Map());
  }
  for (const tx of txs) {
    if (tx.method !== 'card' || tx.cardId == null || tx.kind !== 'expense') continue;
    const card = cards.find((c) => c.id === tx.cardId);
    if (!card) continue;
    const cm = closingMonthOf(card, tx.date);
    const m = byCard.get(tx.cardId)!;
    m.set(cm, (m.get(cm) ?? 0) + tx.amount);
  }
  return byCard;
}

/** 引落月別のカード支払額 (確定した締め期間のみ) */
export function cardPaymentsByMonth(cards: Card[], txs: Transaction[]): Map<string, number> {
  const usage = cardUsageByClosingMonth(cards, txs);
  const byMonth = new Map<string, number>();
  for (const card of cards) {
    if (card.id == null) continue;
    for (const [closingMonth, amount] of usage.get(card.id)!) {
      const payDate = paymentDateOf(card, closingMonth);
      const payMonth = ymOf(payDate);
      byMonth.set(payMonth, (byMonth.get(payMonth) ?? 0) + amount);
    }
  }
  return byMonth;
}

/**
 * 向こう months ヶ月の資金予測。
 * - 固定収支: recurringItems
 * - カード引落: 記帳済み利用から算出。まだ利用実績がない先の月は直近3ヶ月のカード利用平均で予測
 * - 変動費: 直近3ヶ月の現金・口座払い支出(固定費カテゴリ除く)の平均
 */
export function forecast(
  items: RecurringItem[],
  cards: Card[],
  txs: Transaction[],
  startBalance: number,
  months = 6,
  baseMonth = thisMonth(),
): MonthForecast[] {
  const cardPay = cardPaymentsByMonth(cards, txs);

  // 直近3ヶ月 (前月から遡って) の平均を計算
  const last3 = [addMonths(baseMonth, -1), addMonths(baseMonth, -2), addMonths(baseMonth, -3)];
  const recurringCatIds = new Set(items.filter((i) => i.kind === 'expense').map((i) => i.categoryId));

  let cardSum = 0;
  let variableSum = 0;
  for (const tx of txs) {
    const ym = ymOf(tx.date);
    if (!last3.includes(ym) || tx.kind !== 'expense') continue;
    if (tx.method === 'card') cardSum += tx.amount;
    else if (!recurringCatIds.has(tx.categoryId)) variableSum += tx.amount;
  }
  const cardAvg = Math.round(cardSum / 3);
  const variableAvg = Math.round(variableSum / 3);

  const result: MonthForecast[] = [];
  let balance = startBalance;
  for (let i = 0; i < months; i++) {
    const ym = addMonths(baseMonth, i);
    const rec = recurringTotals(items, ym);
    const confirmed = cardPay.get(ym) ?? 0;
    // 未来の月ほどカード実績が入っていないので、実績が平均を下回る場合は平均で補完
    const cardPayment = i === 0 ? Math.max(confirmed, cardAvg > 0 ? cardAvg : confirmed) : confirmed > 0 ? Math.max(confirmed, cardAvg) : cardAvg;
    const net = rec.income - rec.expense - cardPayment - variableAvg;
    balance += net;
    result.push({
      month: ym,
      income: rec.income,
      fixedExpense: rec.expense,
      cardPayment,
      variableExpense: variableAvg,
      net,
      balance,
      confirmedCard: confirmed > 0 && confirmed >= cardAvg,
    });
  }
  return result;
}
