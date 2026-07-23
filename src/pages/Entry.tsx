import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Kind, type Method, type Transaction } from '../db/schema';
import { today } from '../lib/fiscal';
import { dateLabel, yen } from '../lib/format';

export default function Entry() {
  const [kind, setKind] = useState<Kind>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>('card');
  const [cardId, setCardId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [savedFlash, setSavedFlash] = useState('');

  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? [];
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? [];
  const recent = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(15).toArray(),
    [],
  ) ?? [];

  const kindCategories = categories.filter((c) => c.kind === kind && !c.archived);

  // よく使う組み合わせ(直近の記帳から)をテンプレートとして提示
  const templates = useMemo(() => {
    const seen = new Map<string, Transaction>();
    for (const tx of recent) {
      if (tx.kind !== 'expense') continue;
      const key = `${tx.categoryId}|${tx.method}|${tx.cardId ?? ''}`;
      if (!seen.has(key)) seen.set(key, tx);
      if (seen.size >= 4) break;
    }
    return [...seen.values()];
  }, [recent]);

  const applyTemplate = (tx: Transaction) => {
    setKind(tx.kind);
    setCategoryId(tx.categoryId);
    setMethod(tx.method);
    setCardId(tx.cardId ?? null);
  };

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? '?';
  const cardName = (id?: number) => cards.find((c) => c.id === id)?.name ?? '';

  const canSave = amount !== '' && Number(amount) > 0 && categoryId != null && (method !== 'card' || cardId != null);

  const save = async () => {
    if (!canSave || categoryId == null) return;
    await db.transactions.add({
      date,
      amount: Number(amount),
      kind,
      categoryId,
      method,
      cardId: method === 'card' ? (cardId ?? undefined) : undefined,
      memo: memo.trim(),
      source: 'manual',
    });
    setAmount('');
    setMemo('');
    setSavedFlash(`${yen(Number(amount))} を記帳しました`);
    setTimeout(() => setSavedFlash(''), 2500);
  };

  const remove = async (id?: number) => {
    if (id == null) return;
    if (confirm('この記帳を削除しますか?')) await db.transactions.delete(id);
  };

  return (
    <div>
      <div className="card-panel">
        <div className="seg" style={{ marginBottom: 10 }}>
          <button className={kind === 'expense' ? 'on expense' : ''} onClick={() => { setKind('expense'); setCategoryId(null); }}>
            支出
          </button>
          <button className={kind === 'income' ? 'on' : ''} onClick={() => { setKind('income'); setCategoryId(null); setMethod('bank'); }}>
            収入
          </button>
        </div>

        <div className="row" style={{ marginBottom: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            className="amount-input"
            style={{ flex: 1, minWidth: 140 }}
            type="number"
            inputMode="numeric"
            placeholder="金額"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {templates.length > 0 && kind === 'expense' && (
          <>
            <h3>よく使う</h3>
            <div className="chip-row">
              {templates.map((t) => (
                <button key={t.id} className="tpl-btn" onClick={() => applyTemplate(t)}>
                  {catName(t.categoryId)}
                  {t.method === 'card' ? ` / ${cardName(t.cardId)}` : t.method === 'cash' ? ' / 現金' : ' / 口座'}
                </button>
              ))}
            </div>
          </>
        )}

        <h3>カテゴリ</h3>
        <div className="chip-row">
          {kindCategories.map((c) => (
            <button
              key={c.id}
              className={categoryId === c.id ? (kind === 'income' ? 'chip income-selected' : 'chip selected') : 'chip'}
              onClick={() => setCategoryId(c.id!)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {kind === 'expense' && (
          <>
            <h3>支払方法</h3>
            <div className="seg" style={{ marginBottom: 8 }}>
              <button className={method === 'card' ? 'on' : ''} onClick={() => setMethod('card')}>カード</button>
              <button className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>現金</button>
              <button className={method === 'bank' ? 'on' : ''} onClick={() => setMethod('bank')}>口座振替</button>
            </div>
            {method === 'card' && (
              <div className="chip-row">
                {cards.filter((c) => !c.archived).map((c) => (
                  <button key={c.id} className={cardId === c.id ? 'chip selected' : 'chip'} onClick={() => setCardId(c.id!)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <input
          style={{ width: '100%', margin: '8px 0' }}
          placeholder="メモ (任意)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <button className="primary" disabled={!canSave} onClick={save}>
          記帳する
        </button>
        {savedFlash && <p className="hint" style={{ color: 'var(--green)', marginTop: 6 }}>✓ {savedFlash}</p>}
      </div>

      <div className="card-panel">
        <h2>最近の記帳</h2>
        {recent.length === 0 && <p className="hint">まだ記帳がありません。上のフォームから最初の1件を入力してみてください。</p>}
        <ul className="tx-list">
          {recent.map((tx) => (
            <li key={tx.id}>
              <span className="tx-date">{dateLabel(tx.date)}</span>
              <div className="tx-main">
                <div className="tx-cat">
                  {catName(tx.categoryId)}
                  {tx.method === 'card' && <span className="hint"> ・{cardName(tx.cardId)}</span>}
                </div>
                {tx.memo && <div className="tx-memo">{tx.memo}</div>}
              </div>
              <span className={`tx-amount ${tx.kind}`}>
                {tx.kind === 'expense' ? '−' : '+'}
                {yen(tx.amount)}
              </span>
              <button className="danger-ghost" onClick={() => remove(tx.id)}>削除</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
