import { db, type Category, type Card, type Account, type RecurringItem } from './schema';

// 既存Excel(2026年度 収支表)の項目をもとにした初期マスタ。
// 設定画面からいつでも編集できる。

const categories: Omit<Category, 'id'>[] = [
  // 収入
  { name: '給与(剛)', group: '給与', kind: 'income', budgetMonthly: 0, sortOrder: 1 },
  { name: '給与(陽子)', group: '給与', kind: 'income', budgetMonthly: 0, sortOrder: 2 },
  { name: '賞与', group: '給与', kind: 'income', budgetMonthly: 0, sortOrder: 3 },
  { name: '児童手当', group: '手当・その他', kind: 'income', budgetMonthly: 0, sortOrder: 4 },
  { name: '売電', group: '手当・その他', kind: 'income', budgetMonthly: 0, sortOrder: 5 },
  { name: '医療の戻り', group: '手当・その他', kind: 'income', budgetMonthly: 0, sortOrder: 6 },
  { name: '利息', group: '手当・その他', kind: 'income', budgetMonthly: 0, sortOrder: 7 },
  { name: 'その他収入', group: '手当・その他', kind: 'income', budgetMonthly: 0, sortOrder: 8 },
  // 支出
  { name: '食費', group: '食費', kind: 'expense', budgetMonthly: 95000, sortOrder: 10 },
  { name: '給食費', group: '食費', kind: 'expense', budgetMonthly: 5300, sortOrder: 11 },
  { name: '外食', group: '食費', kind: 'expense', budgetMonthly: 18000, sortOrder: 12 },
  { name: '日用品', group: '生活用品', kind: 'expense', budgetMonthly: 19000, sortOrder: 13 },
  { name: '衣服費', group: '生活用品', kind: 'expense', budgetMonthly: 15000, sortOrder: 14 },
  { name: '美容関連', group: '生活用品', kind: 'expense', budgetMonthly: 3000, sortOrder: 15 },
  { name: '電気代', group: '光熱・水道', kind: 'expense', budgetMonthly: 21000, sortOrder: 16 },
  { name: '水道代', group: '光熱・水道', kind: 'expense', budgetMonthly: 12500, sortOrder: 17 },
  { name: '住宅ローン', group: '住宅', kind: 'expense', budgetMonthly: 88742, sortOrder: 18 },
  { name: '修理代', group: '住宅', kind: 'expense', budgetMonthly: 8000, sortOrder: 19 },
  { name: '車両費(ローン)', group: '車両', kind: 'expense', budgetMonthly: 19404, sortOrder: 20 },
  { name: '車両費(ガソリン・駐車場)', group: '車両', kind: 'expense', budgetMonthly: 15000, sortOrder: 21 },
  { name: '車両費(車検・修理)', group: '車両', kind: 'expense', budgetMonthly: 0, sortOrder: 22 },
  { name: '自動車保険', group: '車両', kind: 'expense', budgetMonthly: 8000, sortOrder: 23 },
  { name: '生命保険', group: '保険', kind: 'expense', budgetMonthly: 41000, sortOrder: 24 },
  { name: '医療費', group: '健康・医療', kind: 'expense', budgetMonthly: 12500, sortOrder: 25 },
  { name: '電話・ネット', group: '通信', kind: 'expense', budgetMonthly: 6000, sortOrder: 26 },
  { name: 'スマホ代', group: '通信', kind: 'expense', budgetMonthly: 8000, sortOrder: 27 },
  { name: '新聞代', group: '教養・その他', kind: 'expense', budgetMonthly: 5000, sortOrder: 28 },
  { name: '学校費', group: '教育', kind: 'expense', budgetMonthly: 18000, sortOrder: 29 },
  { name: '塾・習い事', group: '教育', kind: 'expense', budgetMonthly: 42000, sortOrder: 30 },
  { name: 'レジャー・教養・本', group: '教養・その他', kind: 'expense', budgetMonthly: 8000, sortOrder: 31 },
  { name: '交際費', group: '教養・その他', kind: 'expense', budgetMonthly: 5000, sortOrder: 32 },
  { name: '旅費交通費', group: '教養・その他', kind: 'expense', budgetMonthly: 0, sortOrder: 33 },
  { name: '自治会関連', group: '教養・その他', kind: 'expense', budgetMonthly: 1000, sortOrder: 34 },
  { name: 'おこづかい(子供)', group: 'おこづかい', kind: 'expense', budgetMonthly: 10000, sortOrder: 35 },
  { name: 'おこづかい(大人)', group: 'おこづかい', kind: 'expense', budgetMonthly: 0, sortOrder: 36 },
  { name: '税金(自動車税・固定資産税等)', group: '税金', kind: 'expense', budgetMonthly: 0, sortOrder: 37 },
  { name: '預金・積立', group: '預金・積立', kind: 'expense', budgetMonthly: 55250, sortOrder: 38 },
  { name: '銀行等手数料', group: '教養・その他', kind: 'expense', budgetMonthly: 0, sortOrder: 39 },
  { name: 'その他支出', group: '教養・その他', kind: 'expense', budgetMonthly: 3000, sortOrder: 40 },
];

// 締め日・支払日は一般的なカード会社の規定をもとにした初期値。
// Excelのメモ(セゾン4日/三井住友26日/ココカラ・PAYPAY27日)と整合。要確認のものは設定画面で修正する。
const cards: Omit<Card, 'id'>[] = [
  { name: 'セゾン(剛)', holder: '剛', closingDay: 10, paymentDay: 4, paymentMonthOffset: 1, note: '10日締め・翌月4日払い' },
  { name: 'セゾン(陽子)', holder: '陽子', closingDay: 10, paymentDay: 4, paymentMonthOffset: 1, note: '10日締め・翌月4日払い' },
  { name: 'FFGカード(陽子)', holder: '陽子', closingDay: 15, paymentDay: 10, paymentMonthOffset: 1, note: '15日締め・翌月10日払い(要確認)' },
  { name: '三井住友カード(剛)', holder: '剛', closingDay: 31, paymentDay: 26, paymentMonthOffset: 1, note: '月末締め・翌月26日払い' },
  { name: 'ココカラカード(剛)', holder: '剛', closingDay: 31, paymentDay: 27, paymentMonthOffset: 1, note: '月末締め・翌月27日払い(要確認)' },
  { name: 'ココカラカード(陽子)', holder: '陽子', closingDay: 31, paymentDay: 27, paymentMonthOffset: 1, note: '月末締め・翌月27日払い(要確認)' },
  { name: 'PAYPAYカード(剛)', holder: '剛', closingDay: 31, paymentDay: 27, paymentMonthOffset: 1, note: '月末締め・翌月27日払い' },
  { name: 'PAYPAYカード(陽子)', holder: '陽子', closingDay: 31, paymentDay: 27, paymentMonthOffset: 1, note: '月末締め・翌月27日払い' },
  { name: '夢カード(剛)', holder: '剛', closingDay: 31, paymentDay: 27, paymentMonthOffset: 1, note: '要確認' },
  { name: 'イオンカード', holder: '陽子', closingDay: 10, paymentDay: 2, paymentMonthOffset: 1, note: '10日締め・翌月2日払い' },
  { name: 'ジャックス(剛)', holder: '剛', closingDay: 31, paymentDay: 27, paymentMonthOffset: 1, note: '月末締め・翌月27日払い' },
];

const accounts: Omit<Account, 'id'>[] = [
  { name: '現金', holder: '共通', kind: '現金', sortOrder: 0 },
  { name: '十八親和銀行 3005777(剛・給与)', holder: '剛', kind: '銀行', sortOrder: 1 },
  { name: '十八親和銀行 243553(陽子・給与)', holder: '陽子', kind: '銀行', sortOrder: 2 },
  { name: '十八親和銀行 243553(定期)', holder: '陽子', kind: '銀行', sortOrder: 3 },
  { name: '十八親和銀行 3025411(才弥)', holder: '才弥', kind: '銀行', sortOrder: 4 },
  { name: '郵貯銀行 2074295', holder: '共通', kind: '銀行', sortOrder: 5 },
  { name: '郵貯銀行 2073681(花奈)', holder: '花奈', kind: '銀行', sortOrder: 6 },
  { name: 'JAバンク 0032266', holder: '共通', kind: '銀行', sortOrder: 7 },
  { name: 'SBI(剛)', holder: '剛', kind: '証券', sortOrder: 8 },
  { name: 'SBI(陽子)', holder: '陽子', kind: '証券', sortOrder: 9 },
  { name: '財形(剛)', holder: '剛', kind: '財形', sortOrder: 10 },
  { name: '財形(陽子)', holder: '陽子', kind: '財形', sortOrder: 11 },
];

interface RecurringSeed {
  name: string;
  kind: 'income' | 'expense';
  amount: number;
  categoryName: string;
  dayOfMonth: number;
  months?: number[];
}

// Excel 2026年度4月の実績値をもとにした固定収支
const recurringSeeds: RecurringSeed[] = [
  { name: '給与(剛・手取り)', kind: 'income', amount: 351625, categoryName: '給与(剛)', dayOfMonth: 25 },
  { name: '給与(陽子・手取り)', kind: 'income', amount: 287515, categoryName: '給与(陽子)', dayOfMonth: 25 },
  { name: '児童手当', kind: 'income', amount: 40000, categoryName: '児童手当', dayOfMonth: 10, months: [2, 4, 6, 8, 10, 12] },
  { name: '住宅ローン', kind: 'expense', amount: 88742, categoryName: '住宅ローン', dayOfMonth: 27 },
  { name: 'NBOXローン', kind: 'expense', amount: 19404, categoryName: '車両費(ローン)', dayOfMonth: 27 },
  { name: '電話・インターネット', kind: 'expense', amount: 5388, categoryName: '電話・ネット', dayOfMonth: 27 },
  { name: '新聞代(長﨑新聞)', kind: 'expense', amount: 3086, categoryName: '新聞代', dayOfMonth: 27 },
  { name: '中学校給食費', kind: 'expense', amount: 5300, categoryName: '給食費', dayOfMonth: 27 },
  { name: '習字月謝(さや)', kind: 'expense', amount: 2000, categoryName: '塾・習い事', dayOfMonth: 27 },
  { name: '英語月謝(さや)', kind: 'expense', amount: 4000, categoryName: '塾・習い事', dayOfMonth: 27 },
  { name: '伸明ゼミ月謝(さや)', kind: 'expense', amount: 22000, categoryName: '塾・習い事', dayOfMonth: 27 },
  { name: '第一生命(剛)', kind: 'expense', amount: 25686, categoryName: '生命保険', dayOfMonth: 27 },
  { name: '三井保険(剛)', kind: 'expense', amount: 15252, categoryName: '生命保険', dayOfMonth: 27 },
  { name: '自動車保険(陽子)', kind: 'expense', amount: 6320, categoryName: '自動車保険', dayOfMonth: 27 },
  { name: 'SMFSクウォーク(洗濯機・冷蔵庫)', kind: 'expense', amount: 6941, categoryName: 'その他支出', dayOfMonth: 27 },
  { name: 'SMFSクウォーク(コンピュータ関連)', kind: 'expense', amount: 4800, categoryName: 'その他支出', dayOfMonth: 27 },
  { name: '財形貯蓄(剛・給与引き)', kind: 'expense', amount: 3000, categoryName: '預金・積立', dayOfMonth: 25 },
  { name: '積立貯蓄(陽子・給与引き)', kind: 'expense', amount: 10000, categoryName: '預金・積立', dayOfMonth: 25 },
  { name: '財形貯蓄積立(陽子・給与引き)', kind: 'expense', amount: 20000, categoryName: '預金・積立', dayOfMonth: 25 },
  { name: 'こうのうきん', kind: 'expense', amount: 22250, categoryName: '預金・積立', dayOfMonth: 27 },
];

export async function seedIfEmpty(): Promise<boolean> {
  const count = await db.categories.count();
  if (count > 0) return false;

  await db.transaction('rw', [db.categories, db.cards, db.accounts, db.recurring, db.settings], async () => {
    const catIds = await db.categories.bulkAdd(categories as Category[], { allKeys: true });
    const catIdByName = new Map<string, number>();
    categories.forEach((c, i) => catIdByName.set(c.name, catIds[i] as number));

    await db.cards.bulkAdd(cards as Card[]);
    await db.accounts.bulkAdd(accounts as Account[]);

    const recurring: Omit<RecurringItem, 'id'>[] = recurringSeeds.map((r) => ({
      name: r.name,
      kind: r.kind,
      amount: r.amount,
      categoryId: catIdByName.get(r.categoryName)!,
      dayOfMonth: r.dayOfMonth,
      months: r.months,
      method: 'bank',
      active: true,
    }));
    await db.recurring.bulkAdd(recurring as RecurringItem[]);
    await db.settings.put({ key: 'seededAt', value: new Date().toISOString() });
    await db.settings.put({ key: 'mastersUpdatedAt', value: new Date().toISOString() });
  });
  return true;
}
