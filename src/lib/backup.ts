import {
  db,
  type Account,
  type BalanceSnapshot,
  type Card,
  type Category,
  type Deletion,
  type MfMapping,
  type RecurringItem,
  type Setting,
  type Transaction,
} from '../db/schema';

// バックアップ/同期で使うデータ一式のスナップショット
export interface Snapshot {
  exportedAt: string;
  mastersUpdatedAt: string; // カテゴリ・カード等マスタの最終更新時刻 (同期の勝敗判定用)
  transactions: Transaction[];
  deletions: Deletion[];
  categories: Category[];
  cards: Card[];
  accounts: Account[];
  balances: BalanceSnapshot[];
  recurring: RecurringItem[];
  mfMappings: MfMapping[];
  settings: Setting[];
}

export async function exportData(): Promise<Snapshot> {
  const mastersUpdatedAt = (await db.settings.get('mastersUpdatedAt'))?.value ?? new Date(0).toISOString();
  return {
    exportedAt: new Date().toISOString(),
    mastersUpdatedAt,
    transactions: await db.transactions.toArray(),
    deletions: await db.deletions.toArray(),
    categories: await db.categories.toArray(),
    cards: await db.cards.toArray(),
    accounts: await db.accounts.toArray(),
    balances: await db.balances.toArray(),
    recurring: await db.recurring.toArray(),
    mfMappings: await db.mfMappings.toArray(),
    settings: await db.settings.toArray(),
  };
}

export async function importData(data: Partial<Snapshot>): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    if (data.categories) await db.categories.bulkAdd(data.categories);
    if (data.cards) await db.cards.bulkAdd(data.cards);
    if (data.accounts) await db.accounts.bulkAdd(data.accounts);
    if (data.balances) await db.balances.bulkAdd(data.balances);
    if (data.recurring) await db.recurring.bulkAdd(data.recurring);
    if (data.mfMappings) await db.mfMappings.bulkAdd(data.mfMappings);
    if (data.deletions) await db.deletions.bulkAdd(data.deletions);
    if (data.settings) await db.settings.bulkAdd(data.settings);
    if (data.transactions) {
      // id は端末ローカルの連番なので振り直す (uid が同一性のキー)
      const txs = data.transactions.map(({ id, ...rest }) => rest as Transaction);
      await db.transactions.bulkAdd(txs);
    }
  });
}

/** マスタ(カテゴリ・カード・固定費など)を編集したら呼ぶ。同期時にどちらの端末のマスタを採用するかの判定に使う */
export async function touchMasters(): Promise<void> {
  await db.settings.put({ key: 'mastersUpdatedAt', value: new Date().toISOString() });
}
