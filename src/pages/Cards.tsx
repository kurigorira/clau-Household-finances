import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card } from '../db/schema';
import { addMonths, thisMonth, today, ymOf } from '../lib/fiscal';
import { closingMonthOf, paymentDateOf, usePeriodOfClosingMonth } from '../lib/cardCycle';
import { dateLabel, yen, ymLabel } from '../lib/format';

interface PayEvent {
  date: string;
  name: string;
  amount: number;
  detail: string;
  estimated: boolean;
}

export default function Cards() {
  const [month, setMonth] = useState(thisMonth());

  const cards = useLiveQuery(() => db.cards.filter((c) => !c.archived).toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.where('date').above('2000-01-01').toArray(), []) ?? [];
  const recurring = useLiveQuery(() => db.recurring.filter((r) => r.active).toArray(), []) ?? [];

  const cardTxs = txs.filter((t) => t.method === 'card' && t.kind === 'expense' && t.cardId != null);

  const usageOfClosingMonth = (card: Card, closingMonth: string) =>
    cardTxs
      .filter((t) => t.cardId === card.id && closingMonthOf(card, t.date) === closingMonth)
      .reduce((s, t) => s + t.amount, 0);

  // 指定月に引き落とされるイベント一覧
  const events: PayEvent[] = [];
  for (const card of cards) {
    // この月に引落日が来る締め月を逆算
    for (const offset of [-3, -2, -1, 0, 1]) {
      const closingMonth = addMonths(month, offset);
      const payDate = paymentDateOf(card, closingMonth);
      if (ymOf(payDate) !== month) continue;
      const amount = usageOfClosingMonth(card, closingMonth);
      if (amount === 0) continue;
      const period = usePeriodOfClosingMonth(card, closingMonth);
      const stillOpen = today() <= period.to;
      events.push({
        date: payDate,
        name: card.name,
        amount,
        detail: `利用期間 ${period.from.slice(5).replace('-', '/')}〜${period.to.slice(5).replace('-', '/')}`,
        estimated: stillOpen,
      });
    }
  }
  for (const r of recurring) {
    if (r.kind !== 'expense' || r.method === 'card') continue;
    if (r.months && !r.months.includes(parseInt(month.slice(5), 10))) continue;
    const day = Math.min(r.dayOfMonth, 28);
    events.push({
      date: `${month}-${String(day).padStart(2, '0')}`,
      name: r.name,
      amount: r.amount,
      detail: '固定費 (口座振替)',
      estimated: false,
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  const eventTotal = events.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="card-panel">
        <h2>カード利用状況</h2>
        {cards.map((card) => {
          const nowClosing = closingMonthOf(card, today());
          const nowUsage = usageOfClosingMonth(card, nowClosing);
          const nowPeriod = usePeriodOfClosingMonth(card, nowClosing);
          const nowPay = paymentDateOf(card, nowClosing);
          const prevClosing = addMonths(nowClosing, -1);
          const prevUsage = usageOfClosingMonth(card, prevClosing);
          const prevPay = paymentDateOf(card, prevClosing);
          if (nowUsage === 0 && prevUsage === 0) return null;
          return (
            <div key={card.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
              <div className="row spread">
                <strong>{card.name}</strong>
                <span className="badge">{card.note ?? ''}</span>
              </div>
              <div className="row spread" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                <span className="hint">
                  今期利用中 ({nowPeriod.from.slice(5).replace('-', '/')}〜{nowPeriod.to.slice(5).replace('-', '/')})
                  → {dateLabel(nowPay)} 引落
                </span>
                <strong>{yen(nowUsage)}</strong>
              </div>
              {prevUsage > 0 && (
                <div className="row spread" style={{ fontSize: '0.85rem' }}>
                  <span className="hint">前期確定分 → {dateLabel(prevPay)} 引落</span>
                  <strong>{yen(prevUsage)}</strong>
                </div>
              )}
            </div>
          );
        })}
        {cardTxs.length === 0 && (
          <p className="hint">
            カード払いの記帳がまだありません。「記帳」タブで支払方法にカードを選ぶと、締め日・支払日から引落予定を自動計算します。
          </p>
        )}
      </div>

      <div className="month-nav">
        <button className="ghost" onClick={() => setMonth(addMonths(month, -1))}>◀ 前月</button>
        <span className="title">{ymLabel(month)}の引落予定</span>
        <button className="ghost" onClick={() => setMonth(addMonths(month, 1))}>翌月 ▶</button>
      </div>

      <div className="card-panel">
        <div className="row spread" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>引落カレンダー</h2>
          <span className="big-number" style={{ fontSize: '1.1rem' }}>{yen(eventTotal)}</span>
        </div>
        {events.length === 0 && <p className="hint">この月の引落予定はまだありません。</p>}
        <ul className="pay-cal">
          {events.map((e, i) => (
            <li key={i}>
              <span className="pay-day">{dateLabel(e.date)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {e.name} {e.estimated && <span className="badge warn">利用集計中</span>}
                </div>
                <div className="hint">{e.detail}</div>
              </div>
              <strong>{yen(e.amount)}</strong>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ marginTop: 8 }}>
          「利用集計中」はまだ締め日前のため、金額が増える可能性があります。固定費は設定タブの固定収支から編集できます。
        </p>
      </div>
    </div>
  );
}
