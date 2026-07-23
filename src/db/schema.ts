import Dexie, { type Table } from 'dexie';

export type Kind = 'income' | 'expense';
export type Method = 'cash' | 'card' | 'bank';
export type Source = 'manual' | 'mf';

export interface Transaction {
  id?: number;
  date: string; // YYYY-MM-DD
  amount: number; // 常に正の値。kindで収入/支出を区別
  kind: Kind;
  categoryId: number;
  method: Method;
  cardId?: number; // method==='card' のとき
  accountId?: number; // method==='bank' のとき
  memo: string;
  source: Source;
  mfHash?: string; // マネーフォワード取込の重複除外キー
}

export interface Category {
  id?: number;
  name: string;
  group: string; // 大分類(食費/光熱費/教育…)
  kind: Kind;
  budgetMonthly: number; // 0 = 予算未設定
  sortOrder: number;
  archived?: boolean;
}

export interface Card {
  id?: number;
  name: string;
  holder: string; // 剛 / 陽子
  closingDay: number; // 締め日 (31 = 月末)
  paymentDay: number; // 引落日
  paymentMonthOffset: number; // 締め月から引落月までの月数 (1 = 翌月)
  paymentAccountId?: number;
  note?: string;
  archived?: boolean;
}

export interface Account {
  id?: number;
  name: string;
  holder: string;
  kind: string; // 銀行 / 財形 / 証券 / 現金
  sortOrder: number;
  archived?: boolean;
}

export interface BalanceSnapshot {
  id?: number;
  accountId: number;
  month: string; // YYYY-MM
  balance: number;
}

// 固定収支(給与・ローン・月謝など)。資金予測と月次テンプレートの元データ
export interface RecurringItem {
  id?: number;
  name: string;
  kind: Kind;
  amount: number;
  categoryId: number;
  dayOfMonth: number; // 発生日
  months?: number[]; // 発生月(1-12)。undefined = 毎月
  method: Method;
  cardId?: number;
  active: boolean;
}

// MF取込時の 大項目/中項目 → カテゴリ の学習マッピング
export interface MfMapping {
  id?: number;
  mfKey: string; // `${大項目}/${中項目}`
  categoryId: number;
}

export interface Setting {
  key: string;
  value: string;
}

export class KakeiboDB extends Dexie {
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, number>;
  cards!: Table<Card, number>;
  accounts!: Table<Account, number>;
  balances!: Table<BalanceSnapshot, number>;
  recurring!: Table<RecurringItem, number>;
  mfMappings!: Table<MfMapping, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('kurihara-kakeibo');
    this.version(1).stores({
      transactions: '++id, date, categoryId, cardId, mfHash, [kind+date]',
      categories: '++id, group, kind, sortOrder',
      cards: '++id, name',
      accounts: '++id, sortOrder',
      balances: '++id, [accountId+month], month',
      recurring: '++id, categoryId, active',
      mfMappings: '++id, &mfKey',
      settings: 'key',
    });
  }
}

export const db = new KakeiboDB();
