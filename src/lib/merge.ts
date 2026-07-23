import type { Snapshot } from './backup';
import type { Deletion, Transaction } from '../db/schema';

// 2端末のスナップショットの双方向マージ。
// - 記帳 (transactions): uid で和集合。削除記録 (deletions) は双方に適用。
//   マネーフォワード取込は mfHash でも重複除外 (両端末が同じCSVを取り込んだ場合)
// - マスタ (カテゴリ・カード・口座・固定費・残高・設定): mastersUpdatedAt が新しい側を採用
// - MFカテゴリ学習 (mfMappings): mfKey で和集合 (ローカル優先)

export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  // 削除記録の和集合
  const deletionByUid = new Map<string, Deletion>();
  for (const d of [...remote.deletions ?? [], ...local.deletions ?? []]) deletionByUid.set(d.uid, d);
  const deletedUids = new Set(deletionByUid.keys());

  // 記帳の和集合 (ローカル優先) − 削除済み
  const txByUid = new Map<string, Transaction>();
  const seenMfHash = new Set<string>();
  const addTx = (t: Transaction) => {
    if (!t.uid || deletedUids.has(t.uid)) return;
    if (txByUid.has(t.uid)) return;
    if (t.mfHash) {
      if (seenMfHash.has(t.mfHash)) return;
      seenMfHash.add(t.mfHash);
    }
    txByUid.set(t.uid, t);
  };
  for (const t of local.transactions ?? []) addTx(t);
  for (const t of remote.transactions ?? []) addTx(t);

  // マスタは新しく更新された側を採用
  const localMastersAt = local.mastersUpdatedAt ?? '';
  const remoteMastersAt = remote.mastersUpdatedAt ?? '';
  const masters = remoteMastersAt > localMastersAt ? remote : local;

  // MF学習マッピングは和集合 (ローカル優先)
  const mapByKey = new Map<string, Snapshot['mfMappings'][number]>();
  for (const m of [...remote.mfMappings ?? [], ...local.mfMappings ?? []]) {
    mapByKey.set(m.mfKey, m);
  }

  return {
    exportedAt: new Date().toISOString(),
    mastersUpdatedAt: remoteMastersAt > localMastersAt ? remoteMastersAt : localMastersAt,
    transactions: [...txByUid.values()].sort((a, b) => a.date.localeCompare(b.date)),
    deletions: [...deletionByUid.values()],
    categories: masters.categories ?? [],
    cards: masters.cards ?? [],
    accounts: masters.accounts ?? [],
    balances: masters.balances ?? [],
    recurring: masters.recurring ?? [],
    mfMappings: [...mapByKey.values()].map(({ id, ...rest }) => rest as Snapshot['mfMappings'][number]),
    settings: masters.settings ?? [],
  };
}
