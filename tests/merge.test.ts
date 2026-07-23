import { describe, it, expect } from 'vitest';
import { mergeSnapshots } from '../src/lib/merge';
import type { Snapshot } from '../src/lib/backup';
import type { Transaction } from '../src/db/schema';

function tx(uid: string, date: string, amount: number, mfHash?: string): Transaction {
  return { uid, date, amount, kind: 'expense', categoryId: 1, method: 'cash', memo: '', source: 'manual', mfHash };
}

function snap(partial: Partial<Snapshot>): Snapshot {
  return {
    exportedAt: '2026-07-01T00:00:00Z',
    mastersUpdatedAt: '2026-07-01T00:00:00Z',
    transactions: [],
    deletions: [],
    categories: [],
    cards: [],
    accounts: [],
    balances: [],
    recurring: [],
    mfMappings: [],
    settings: [],
    ...partial,
  };
}

describe('mergeSnapshots', () => {
  it('両端末の記帳をuidで和集合にする', () => {
    const local = snap({ transactions: [tx('a', '2026-07-01', 100), tx('b', '2026-07-02', 200)] });
    const remote = snap({ transactions: [tx('b', '2026-07-02', 200), tx('c', '2026-07-03', 300)] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.transactions.map((t) => t.uid)).toEqual(['a', 'b', 'c']);
  });

  it('削除記録は双方に適用される', () => {
    const local = snap({ transactions: [tx('a', '2026-07-01', 100)] });
    const remote = snap({
      transactions: [tx('a', '2026-07-01', 100)],
      deletions: [{ uid: 'a', deletedAt: '2026-07-05T00:00:00Z' }],
    });
    const merged = mergeSnapshots(local, remote);
    expect(merged.transactions).toHaveLength(0);
    expect(merged.deletions).toHaveLength(1);
  });

  it('同じMF CSVを両端末で取り込んでも mfHash で重複除外される', () => {
    const local = snap({ transactions: [tx('a', '2026-07-01', 100, 'id:x1')] });
    const remote = snap({ transactions: [tx('b', '2026-07-01', 100, 'id:x1')] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.transactions).toHaveLength(1);
  });

  it('マスタは mastersUpdatedAt が新しい側を採用する', () => {
    const local = snap({
      mastersUpdatedAt: '2026-07-01T00:00:00Z',
      categories: [{ id: 1, name: '古い', group: 'g', kind: 'expense', budgetMonthly: 0, sortOrder: 1 }],
    });
    const remote = snap({
      mastersUpdatedAt: '2026-07-10T00:00:00Z',
      categories: [{ id: 1, name: '新しい', group: 'g', kind: 'expense', budgetMonthly: 0, sortOrder: 1 }],
    });
    expect(mergeSnapshots(local, remote).categories[0].name).toBe('新しい');
    expect(mergeSnapshots(remote, local).categories[0].name).toBe('新しい');
    expect(mergeSnapshots(local, remote).mastersUpdatedAt).toBe('2026-07-10T00:00:00Z');
  });

  it('MF学習マッピングは和集合になる', () => {
    const local = snap({ mfMappings: [{ mfKey: '食費/食料品', categoryId: 1 }] });
    const remote = snap({ mfMappings: [{ mfKey: '食費/外食', categoryId: 2 }] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.mfMappings).toHaveLength(2);
  });
});
