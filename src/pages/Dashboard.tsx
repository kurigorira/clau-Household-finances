import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { db } from '../db/schema';
import { addMonths, monthLabel, thisMonth } from '../lib/fiscal';
import { signedYen, yen, ymLabel } from '../lib/format';

const PIE_COLORS = ['#1a7f5a', '#2471a3', '#c0392b', '#b7950b', '#7d3c98', '#148f77', '#a04000', '#5d6d7e', '#af601a', '#1f618d', '#7b7d7d', '#6c3483'];

export default function Dashboard() {
  const [month, setMonth] = useState(thisMonth());

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const txs = useLiveQuery(
    () => db.transactions.where('date').between(`${month}-01`, `${month}-99`).toArray(),
    [month],
  ) ?? [];

  // 直近6ヶ月の推移
  const trendMonths = [-5, -4, -3, -2, -1, 0].map((i) => addMonths(month, i));
  const trendTxs = useLiveQuery(
    () => db.transactions.where('date').between(`${trendMonths[0]}-01`, `${month}-99`).toArray(),
    [month],
  ) ?? [];

  const income = txs.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);

  const byCategory = new Map<number, number>();
  for (const t of txs) {
    if (t.kind !== 'expense') continue;
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  const catRows = [...byCategory.entries()]
    .map(([id, amount]) => {
      const cat = categories.find((c) => c.id === id);
      return { name: cat?.name ?? '不明', amount, budget: cat?.budgetMonthly ?? 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const pieData = catRows.slice(0, 11);
  const otherSum = catRows.slice(11).reduce((s, r) => s + r.amount, 0);
  if (otherSum > 0) pieData.push({ name: 'その他', amount: otherSum, budget: 0 });

  const trend = trendMonths.map((ym) => {
    const ms = trendTxs.filter((t) => t.date.startsWith(ym));
    return {
      month: monthLabel(ym),
      収入: ms.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0),
      支出: ms.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  const budgetTotal = categories.filter((c) => c.kind === 'expense').reduce((s, c) => s + c.budgetMonthly, 0);

  return (
    <div>
      <div className="month-nav">
        <button className="ghost" onClick={() => setMonth(addMonths(month, -1))}>◀ 前月</button>
        <span className="title">{ymLabel(month)}</span>
        <button className="ghost" onClick={() => setMonth(addMonths(month, 1))}>翌月 ▶</button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="label">収入</div>
          <div className="value" style={{ color: '#2471a3' }}>{yen(income)}</div>
        </div>
        <div className="stat">
          <div className="label">支出</div>
          <div className="value" style={{ color: 'var(--red)' }}>{yen(expense)}</div>
        </div>
        <div className="stat">
          <div className="label">収支</div>
          <div className={`value ${income - expense >= 0 ? 'pos' : 'neg'}`}>{signedYen(income - expense)}</div>
        </div>
      </div>

      {expense > 0 && (
        <div className="card-panel">
          <h2>支出の内訳</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={1}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => yen(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {catRows.map((r) => {
            const over = r.budget > 0 && r.amount > r.budget;
            const pct = r.budget > 0 ? Math.min(100, (r.amount / r.budget) * 100) : 0;
            return (
              <div key={r.name} style={{ marginBottom: 8 }}>
                <div className="row spread">
                  <span style={{ fontSize: '0.85rem' }}>{r.name}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    {yen(r.amount)}
                    {r.budget > 0 && <span className="hint"> / 予算{yen(r.budget)}</span>}
                  </span>
                </div>
                {r.budget > 0 && (
                  <div className="bar-outer">
                    <div className={over ? 'bar-inner over' : 'bar-inner'} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {budgetTotal > 0 && (
            <p className="hint" style={{ marginTop: 8 }}>
              予算合計 {yen(budgetTotal)} に対して {yen(expense)} ({Math.round((expense / budgetTotal) * 100)}%)
            </p>
          )}
        </div>
      )}

      <div className="card-panel">
        <h2>直近6ヶ月の推移</h2>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={10} tickFormatter={(v) => `${Math.round(v / 10000)}万`} width={34} />
              <Tooltip formatter={(v) => yen(Number(v))} />
              <ReferenceLine y={0} stroke="#ccc" />
              <Bar dataKey="収入" fill="#2471a3" />
              <Bar dataKey="支出" fill="#c0392b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {txs.length === 0 && (
        <p className="hint">この月の記帳はまだありません。「記帳」タブから入力するか、「取込」タブでマネーフォワードのCSVを取り込めます。</p>
      )}
    </div>
  );
}
