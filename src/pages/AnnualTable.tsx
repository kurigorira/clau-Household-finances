import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { fiscalMonths, fiscalYearOf, monthLabel, today } from '../lib/fiscal';

function fmt(n: number): string {
  return n === 0 ? '' : n.toLocaleString('ja-JP');
}

// Excelの収支シート相当: カテゴリ×月(4月〜翌3月)のマトリクス
export default function AnnualTable() {
  const [fy, setFy] = useState(fiscalYearOf(today()));
  const months = fiscalMonths(fy);

  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? [];
  const txs = useLiveQuery(
    () => db.transactions.where('date').between(`${months[0]}-01`, `${months[11]}-99`).toArray(),
    [fy],
  ) ?? [];

  const cell = new Map<string, number>(); // `${categoryId}|${ym}` → 金額
  for (const t of txs) {
    const key = `${t.categoryId}|${t.date.slice(0, 7)}`;
    cell.set(key, (cell.get(key) ?? 0) + t.amount);
  }
  const catMonth = (catId: number, ym: string) => cell.get(`${catId}|${ym}`) ?? 0;

  const incomeCats = categories.filter((c) => c.kind === 'income' && !c.archived);
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);

  const colSum = (cats: typeof categories, ym: string) => cats.reduce((s, c) => s + catMonth(c.id!, ym), 0);
  const rowSum = (catId: number) => months.reduce((s, ym) => s + catMonth(catId, ym), 0);

  const renderRows = (cats: typeof categories) =>
    cats.map((c) => {
      const total = rowSum(c.id!);
      if (total === 0) return null;
      return (
        <tr key={c.id}>
          <td className="name">{c.name}</td>
          {months.map((ym) => (
            <td key={ym}>{fmt(catMonth(c.id!, ym))}</td>
          ))}
          <td style={{ fontWeight: 700 }}>{fmt(total)}</td>
        </tr>
      );
    });

  return (
    <div>
      <div className="month-nav">
        <button className="ghost" onClick={() => setFy(fy - 1)}>◀ {fy - 1}年度</button>
        <span className="title">{fy}年度 (4月〜{fy + 1}年3月)</span>
        <button className="ghost" onClick={() => setFy(fy + 1)}>{fy + 1}年度 ▶</button>
      </div>

      <div className="card-panel">
        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th className="name">項目</th>
                {months.map((ym) => (
                  <th key={ym}>{monthLabel(ym)}</th>
                ))}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section">
                <td className="name">収入の部</td>
                <td colSpan={13} />
              </tr>
              {renderRows(incomeCats)}
              <tr className="total">
                <td className="name">収入合計</td>
                {months.map((ym) => (
                  <td key={ym}>{fmt(colSum(incomeCats, ym))}</td>
                ))}
                <td>{fmt(months.reduce((s, ym) => s + colSum(incomeCats, ym), 0))}</td>
              </tr>
              <tr className="section">
                <td className="name">支出の部</td>
                <td colSpan={13} />
              </tr>
              {renderRows(expenseCats)}
              <tr className="total">
                <td className="name">支出合計</td>
                {months.map((ym) => (
                  <td key={ym}>{fmt(colSum(expenseCats, ym))}</td>
                ))}
                <td>{fmt(months.reduce((s, ym) => s + colSum(expenseCats, ym), 0))}</td>
              </tr>
              <tr className="total">
                <td className="name">収支合計</td>
                {months.map((ym) => {
                  const v = colSum(incomeCats, ym) - colSum(expenseCats, ym);
                  return (
                    <td key={ym} style={{ color: v < 0 ? 'var(--red)' : 'inherit' }}>
                      {fmt(v)}
                    </td>
                  );
                })}
                <td>
                  {fmt(months.reduce((s, ym) => s + colSum(incomeCats, ym) - colSum(expenseCats, ym), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          記帳とCSV取込の実績が自動で集計されます (実績のない項目は非表示)。Excelの収支シートと同じ4月始まりです。
        </p>
      </div>
    </div>
  );
}
