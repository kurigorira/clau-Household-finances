import { describe, it, expect } from 'vitest';
import type { Card } from '../src/db/schema';
import { closingMonthOf, paymentDateForUse, usePeriodOfClosingMonth } from '../src/lib/cardCycle';

const saison: Card = { name: 'セゾン(剛)', holder: '剛', closingDay: 10, paymentDay: 4, paymentMonthOffset: 1 };
const smcc: Card = { name: '三井住友(剛)', holder: '剛', closingDay: 31, paymentDay: 26, paymentMonthOffset: 1 };

describe('セゾン (10日締め・翌月4日払い)', () => {
  it('締め日以前の利用はその月締め', () => {
    expect(closingMonthOf(saison, '2026-04-10')).toBe('2026-04');
    expect(paymentDateForUse(saison, '2026-04-10')).toBe('2026-05-04');
  });
  it('締め日の翌日以降は翌月締め', () => {
    expect(closingMonthOf(saison, '2026-04-11')).toBe('2026-05');
    expect(paymentDateForUse(saison, '2026-04-11')).toBe('2026-06-04');
  });
  it('締め期間は前月11日〜当月10日', () => {
    expect(usePeriodOfClosingMonth(saison, '2026-05')).toEqual({ from: '2026-04-11', to: '2026-05-10' });
  });
});

describe('三井住友 (月末締め・翌月26日払い)', () => {
  it('月内の利用はすべてその月締め', () => {
    expect(closingMonthOf(smcc, '2026-04-01')).toBe('2026-04');
    expect(closingMonthOf(smcc, '2026-04-30')).toBe('2026-04');
    expect(paymentDateForUse(smcc, '2026-04-30')).toBe('2026-05-26');
  });
  it('2月の月末締めも正しく扱う', () => {
    expect(closingMonthOf(smcc, '2027-02-28')).toBe('2027-02');
    expect(usePeriodOfClosingMonth(smcc, '2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });
});
