import { describe, it, expect } from 'vitest';
import { guessCategoryName, mfHashOf, parseCsv, parseMfCsv } from '../src/lib/mfCsv';

const sample = `"計算対象","日付","内容","金額(円)","保有金融機関","大項目","中項目","メモ","振替","ID"
"1","2026/07/01","マルキョウ","-3480","PayPayカード","食費","食料品","","0","abc123"
"1","2026/07/02","給与","387430","十八親和銀行","収入","給与","","0","def456"
"0","2026/07/03","口座振替","-10000","十八親和銀行","振替","","","1","ghi789"
`;

describe('parseCsv', () => {
  it('引用符とカンマを処理する', () => {
    const rows = parseCsv('"a,b",c\n"d""e",f');
    expect(rows).toEqual([
      ['a,b', 'c'],
      ['d"e', 'f'],
    ]);
  });
});

describe('parseMfCsv', () => {
  it('MFのCSVを解釈する', () => {
    const { rows, errors } = parseMfCsv(sample);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      include: true,
      date: '2026-07-01',
      description: 'マルキョウ',
      amount: -3480,
      institution: 'PayPayカード',
      largeCat: '食費',
      mfId: 'abc123',
    });
    expect(rows[1].amount).toBe(387430);
    expect(rows[2].include).toBe(false);
    expect(rows[2].isTransfer).toBe(true);
  });

  it('必須列がないとエラー', () => {
    const { errors } = parseMfCsv('a,b,c\n1,2,3');
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('mfHashOf', () => {
  it('IDがあればIDベース', () => {
    const { rows } = parseMfCsv(sample);
    expect(mfHashOf(rows[0])).toBe('id:abc123');
  });
  it('IDがなければ内容ベース', () => {
    const { rows } = parseMfCsv(sample.replace('"abc123"', '""'));
    expect(mfHashOf(rows[0])).toContain('h:2026-07-01|-3480|マルキョウ');
  });
});

describe('guessCategoryName', () => {
  it('大項目・中項目からカテゴリを推測', () => {
    expect(guessCategoryName('食費', '食料品', 'マルキョウ')).toBe('食費');
    expect(guessCategoryName('食費', '外食', 'ジョイフル')).toBe('外食');
    expect(guessCategoryName('水道・光熱費', '電気料金', '九州電力')).toBe('電気代');
    expect(guessCategoryName('', '', '不明な店')).toBeNull();
  });
});
