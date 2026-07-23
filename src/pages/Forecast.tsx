import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { db } from '../db/schema';
import { forecast } from '../lib/forecast';
import { monthLabel, thisMonth } from '../lib/fiscal';
import { signedYen, yen } from '../lib/format';

export default function Forecast() {
  const recurring = useLiveQuery(() => db.recurring.toArray(), []) ?? [];
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.where('date').above('2000-01-01').toArray(), []) ?? [];
  const balanceSetting = useLiveQuery(() => db.settings.get('startBalance'), []);

  const [balanceInput, setBalanceInput] = useState('');
  useEffect(() => {
    if (balanceSetting) setBalanceInput(balanceSetting.value);
  }, [balanceSetting]);

  const startBalance = Number(balanceInput) || 0;
  const rows = forecast(recurring, cards, txs, startBalance, 6, thisMonth());

  const saveBalance = async () => {
    await db.settings.put({ key: 'startBalance', value: String(startBalance) });
  };

  const chartData = rows.map((r) => ({ month: monthLabel(r.month), 残高: r.balance, 収支: r.net }));

  return (
    <div>
      <div className="card-panel">
        <h2>資金予測 (向こう6ヶ月)</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <label style={{ fontSize: '0.85rem' }}>現在の生活口座残高</label>
          <input
            type="number"
            inputMode="numeric"
            style={{ flex: 1, minWidth: 120, textAlign: 'right' }}
            placeholder="例: 280000"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            onBlur={saveBalance}
          />
          <span className="hint">円</span>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={10} tickFormatter={(v) => `${Math.round(v / 10000)}万`} width={40} />
              <Tooltip formatter={(v) => yen(Number(v))} />
              <ReferenceLine y={0} stroke="#c0392b" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="残高" stroke="#1a7f5a" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-panel">
        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th className="name">月</th>
                <th>固定収入</th>
                <th>固定支出</th>
                <th>カード引落</th>
                <th>変動費(平均)</th>
                <th>収支</th>
                <th>予測残高</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="name">{r.month.replace('-', '/')}</td>
                  <td>{r.income.toLocaleString()}</td>
                  <td>{r.fixedExpense.toLocaleString()}</td>
                  <td>
                    {r.cardPayment.toLocaleString()}
                    {!r.confirmedCard && r.cardPayment > 0 ? '※' : ''}
                  </td>
                  <td>{r.variableExpense.toLocaleString()}</td>
                  <td style={{ color: r.net < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                    {signedYen(r.net)}
                  </td>
                  <td style={{ fontWeight: 700, color: r.balance < 0 ? 'var(--red)' : 'inherit' }}>
                    {r.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          固定収支は設定タブの「固定収支」がもとになります。カード引落の「※」は利用実績が揃っていないため直近3ヶ月平均で補完した予測値です。
          変動費(食費・日用品など現金/口座払い)も直近3ヶ月平均で見込んでいます。
        </p>
      </div>
    </div>
  );
}
