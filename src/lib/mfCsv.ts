// マネーフォワードME「家計簿データのダウンロード(CSV)」のパース。
// 列: 計算対象,日付,内容,金額(円),保有金融機関,大項目,中項目,メモ,振替,ID
// 文字コードは Shift_JIS (ダウンロード時期によってはUTF-8のこともある)。

export interface MfRow {
  include: boolean; // 計算対象
  date: string; // YYYY-MM-DD
  description: string; // 内容
  amount: number; // 符号付き (支出は負)
  institution: string; // 保有金融機関
  largeCat: string; // 大項目
  middleCat: string; // 中項目
  memo: string;
  isTransfer: boolean; // 振替
  mfId: string; // ID
}

/** CSVテキスト(1行に改行を含むフィールド対応)を行×列にパース */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function normalizeDate(s: string): string {
  // "2026/04/01" or "2026-04-01" → "2026-04-01"
  const m = s.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function parseAmount(s: string): number {
  const n = Number(s.replace(/[",\s円]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** MF CSVの行を解釈する。ヘッダー行の列名で列位置を特定 */
export function parseMfCsv(text: string): { rows: MfRow[]; errors: string[] } {
  const errors: string[] = [];
  const raw = parseCsv(text);
  if (raw.length === 0) return { rows: [], errors: ['CSVが空です'] };

  const header = raw[0].map((h) => h.replace(/^﻿/, '').trim());
  const col = (name: string) => header.findIndex((h) => h.includes(name));
  const ci = {
    include: col('計算対象'),
    date: col('日付'),
    desc: col('内容'),
    amount: col('金額'),
    institution: col('保有金融機関'),
    large: col('大項目'),
    middle: col('中項目'),
    memo: col('メモ'),
    transfer: col('振替'),
    id: col('ID'),
  };
  if (ci.date < 0 || ci.amount < 0) {
    return { rows: [], errors: ['ヘッダーに「日付」「金額」列が見つかりません。マネーフォワードMEの家計簿CSVを指定してください。'] };
  }

  const rows: MfRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const date = normalizeDate(r[ci.date] ?? '');
    const amount = parseAmount(r[ci.amount] ?? '');
    if (!date || Number.isNaN(amount)) {
      errors.push(`${i + 1}行目をスキップしました (日付または金額が不正)`);
      continue;
    }
    rows.push({
      include: ci.include < 0 ? true : (r[ci.include] ?? '').trim() !== '0',
      date,
      description: (r[ci.desc] ?? '').trim(),
      amount,
      institution: (r[ci.institution] ?? '').trim(),
      largeCat: (r[ci.large] ?? '').trim(),
      middleCat: (r[ci.middle] ?? '').trim(),
      memo: (r[ci.memo] ?? '').trim(),
      isTransfer: (r[ci.transfer] ?? '').trim() === '1',
      mfId: (r[ci.id] ?? '').trim(),
    });
  }
  return { rows, errors };
}

/** 重複除外キー。MFのID列があればそれを、なければ内容から生成 */
export function mfHashOf(row: MfRow): string {
  if (row.mfId) return `id:${row.mfId}`;
  return `h:${row.date}|${row.amount}|${row.description}|${row.institution}`;
}

/** Shift_JIS / UTF-8 を自動判定してデコード */
export async function decodeCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  // UTF-8として不正なバイト列は U+FFFD になる → Shift_JISとして読み直す
  if (utf8.includes('�')) {
    try {
      return new TextDecoder('shift_jis').decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/** MFの大項目/中項目からアプリのカテゴリ名を推測する初期マッピング */
export function guessCategoryName(largeCat: string, middleCat: string, description: string): string | null {
  const t = `${largeCat}/${middleCat}/${description}`;
  const table: [RegExp, string][] = [
    [/外食/, '外食'],
    [/食料品|食費/, '食費'],
    [/日用品|ドラッグストア/, '日用品'],
    [/衣服|ファッション/, '衣服費'],
    [/美容|理容/, '美容関連'],
    [/電気/, '電気代'],
    [/水道/, '水道代'],
    [/ガス/, '電気代'],
    [/住宅ローン|ローン返済/, '住宅ローン'],
    [/ガソリン|駐車場|ETC|交通系/, '車両費(ガソリン・駐車場)'],
    [/自動車保険/, '自動車保険'],
    [/車|カー/, '車両費(車検・修理)'],
    [/生命保険|保険/, '生命保険'],
    [/病院|薬|医療|歯科/, '医療費'],
    [/携帯|スマホ|通信/, 'スマホ代'],
    [/インターネット|プロバイダ/, '電話・ネット'],
    [/新聞/, '新聞代'],
    [/教育|学費|塾|習い事/, '塾・習い事'],
    [/書籍|本|教養|娯楽|レジャー|趣味/, 'レジャー・教養・本'],
    [/交際|プレゼント/, '交際費'],
    [/旅行|交通/, '旅費交通費'],
    [/税金|自動車税|固定資産税|住民税/, '税金(自動車税・固定資産税等)'],
    [/手数料/, '銀行等手数料'],
    [/給与|給料/, '給与(剛)'],
    [/児童手当/, '児童手当'],
    [/利息|配当/, '利息'],
  ];
  for (const [re, name] of table) {
    if (re.test(t)) return name;
  }
  return null;
}
