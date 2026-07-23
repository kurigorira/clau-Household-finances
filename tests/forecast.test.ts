import { describe, it, expect } from 'vitest';
import type { Card, RecurringItem, Transaction } from '../src/db/schema';
import { cardPaymentsByMonth, forecast, recurringTotals } from '../src/lib/forecast';

const items: RecurringItem[] = [
  { name: '給与', kind: 'income', amount: 300000, categoryId: 1, dayOfMonth: 25, method: 'bank', active: true },
  { name: '住宅ローン', kind: 'expense', amount: 88742, categoryId: 2, dayOfMonth: 27, method: 'bank', active: true },
  { name: '児童手当', kind: 'income', amount: 40000, categoryId: 3, dayOfMonth: 10, months: [2, 4, 6], method: 'bank', active: true },
  { name: '無効', kind: 'expense', amount: 99999, categoryId: 4, dayOfMonth: 1, method: 'bank', active: false },
];

describe('recurringTotals', () => {
  it('毎月分と指定月分を集計', () => {
    expect(recurringTotals(items, '2026-04')).toEqual({ income: 340000, expense: 88742 });
    expect(recurringTotals(items, '2026-05')).toEqual({ income: 300000, expense: 88742 });
  });
});

describe('cardPaymentsByMonth', () => {
  const card: Card = { id: 1, name: 'セゾン', holder: '剛', closingDay: 10, paymentDay: 4, paymentMonthOffset: 1 };
  const txs: Transaction[] = [
    { date: '2026-04-05', amount: 5000, kind: 'expense', categoryId: 1, method: 'card', cardId: 1, memo: '', source: 'manual' },
    { date: '2026-04-15', amount: 7000, kind: 'expense', categoryId: 1, method: 'card', cardId: 1, memo: '', source: 'manual' },
  ];
  it('締め月ごとに引落月へ集約', () => {
    const pay = cardPaymentsByMonth([card], txs);
    expect(pay.get('2026-05')).toBe(5000); // 4/5利用 → 4月締め → 5/4引落
    expect(pay.get('2026-06')).toBe(7000); // 4/15利用 → 5月締め → 6/4引落
  });
});

describe('forecast', () => {
  it('残高が月ごとに積み上がる', () => {
    const rows = forecast(items, [], [], 1000000, 3, '2026-07');
    expect(rows).toHaveLength(3);
    const net = 300000 - 88742;
    expect(rows[0].net).toBe(net);
    expect(rows[0].balance).toBe(1000000 + net);
    expect(rows[2].balance).toBe(1000000 + net * 3);
  });
});
