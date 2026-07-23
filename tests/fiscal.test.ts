import { describe, it, expect } from 'vitest';
import { addMonths, clampDate, fiscalMonths, fiscalYearOf, monthLabel } from '../src/lib/fiscal';

describe('fiscalYearOf', () => {
  it('4月以降はその年', () => {
    expect(fiscalYearOf('2026-04-01')).toBe(2026);
    expect(fiscalYearOf('2026-12-31')).toBe(2026);
  });
  it('1〜3月は前年', () => {
    expect(fiscalYearOf('2027-01-01')).toBe(2026);
    expect(fiscalYearOf('2027-03-31')).toBe(2026);
  });
});

describe('fiscalMonths', () => {
  it('4月始まりで12ヶ月', () => {
    const months = fiscalMonths(2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-04');
    expect(months[8]).toBe('2026-12');
    expect(months[9]).toBe('2027-01');
    expect(months[11]).toBe('2027-03');
  });
});

describe('addMonths', () => {
  it('年をまたぐ加算', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-04', 12)).toBe('2027-04');
  });
});

describe('clampDate', () => {
  it('月末日にクランプ', () => {
    expect(clampDate('2026-02', 31)).toBe('2026-02-28');
    expect(clampDate('2028-02', 31)).toBe('2028-02-29');
    expect(clampDate('2026-04', 31)).toBe('2026-04-30');
    expect(clampDate('2026-05', 4)).toBe('2026-05-04');
  });
});

describe('monthLabel', () => {
  it('月ラベル', () => {
    expect(monthLabel('2026-04')).toBe('4月');
    expect(monthLabel('2027-01')).toBe('1月');
  });
});
