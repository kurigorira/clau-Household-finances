import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { yen } from '../lib/format';

type Section = 'recurring' | 'cards' | 'categories' | 'backup';

export default function Settings() {
  const [section, setSection] = useState<Section>('recurring');
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? [];
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? [];
  const recurring = useLiveQuery(() => db.recurring.toArray(), []) ?? [];

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? '?';

  const exportJson = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      cards: await db.cards.toArray(),
      accounts: await db.accounts.toArray(),
      balances: await db.balances.toArray(),
      recurring: await db.recurring.toArray(),
      mfMappings: await db.mfMappings.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kakeibo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | null) => {
    if (!file) return;
    if (!confirm('バックアップを復元すると現在のデータはすべて置き換えられます。よろしいですか?')) return;
    try {
      const data = JSON.parse(await file.text());
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) await table.clear();
        if (data.categories) await db.categories.bulkAdd(data.categories);
        if (data.cards) await db.cards.bulkAdd(data.cards);
        if (data.accounts) await db.accounts.bulkAdd(data.accounts);
        if (data.balances) await db.balances.bulkAdd(data.balances);
        if (data.recurring) await db.recurring.bulkAdd(data.recurring);
        if (data.mfMappings) await db.mfMappings.bulkAdd(data.mfMappings);
        if (data.settings) await db.settings.bulkAdd(data.settings);
        if (data.transactions) await db.transactions.bulkAdd(data.transactions);
      });
      setMessage('復元しました');
    } catch (e) {
      setMessage('復元に失敗しました: ' + String(e));
    }
  };

  return (
    <div>
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {(
          [
            ['recurring', '固定収支'],
            ['cards', 'カード'],
            ['categories', 'カテゴリ・予算'],
            ['backup', 'バックアップ'],
          ] as [Section, string][]
        ).map(([id, label]) => (
          <button key={id} className={section === id ? 'chip selected' : 'chip'} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </div>

      {section === 'recurring' && (
        <div className="card-panel">
          <h2>固定収支 (毎月の給与・ローン・月謝など)</h2>
          <p className="hint" style={{ marginBottom: 8 }}>資金予測と引落カレンダーの計算に使われます。金額が変わったらここを更新してください。</p>
          <ul className="tx-list">
            {recurring.map((r) => (
              <li key={r.id}>
                <div className="tx-main">
                  <div className="tx-cat">{r.name}</div>
                  <div className="tx-memo">
                    {catName(r.categoryId)} ・ 毎月{r.dayOfMonth}日
                    {r.months ? ` (${r.months.join(',')}月)` : ''}
                  </div>
                </div>
                <input
                  type="number"
                  style={{ width: 100, textAlign: 'right', padding: '4px 6px' }}
                  defaultValue={r.amount}
                  onBlur={(e) => db.recurring.update(r.id!, { amount: Number(e.target.value) || 0 })}
                />
                <label style={{ fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => db.recurring.update(r.id!, { active: e.target.checked })}
                  />
                  有効
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === 'cards' && (
        <div className="card-panel">
          <h2>カードの締め日・支払日</h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            締め日31 = 月末締め。初期値はカード会社の一般的な規定です。実際の明細と違う場合はここで直してください。
          </p>
          {cards.map((c) => (
            <div key={c.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
              <strong style={{ fontSize: '0.9rem' }}>{c.name}</strong>
              <div className="row" style={{ marginTop: 4, fontSize: '0.8rem' }}>
                <label>締め日</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  style={{ width: 62, padding: '4px 6px' }}
                  defaultValue={c.closingDay}
                  onBlur={(e) => db.cards.update(c.id!, { closingDay: Number(e.target.value) || 31 })}
                />
                <label>支払日</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  style={{ width: 62, padding: '4px 6px' }}
                  defaultValue={c.paymentDay}
                  onBlur={(e) => db.cards.update(c.id!, { paymentDay: Number(e.target.value) || 27 })}
                />
                <label>翌</label>
                <select
                  defaultValue={c.paymentMonthOffset}
                  style={{ padding: '4px 6px' }}
                  onChange={(e) => db.cards.update(c.id!, { paymentMonthOffset: Number(e.target.value) })}
                >
                  <option value={0}>当月</option>
                  <option value={1}>翌月</option>
                  <option value={2}>翌々月</option>
                </select>
                <label style={{ fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={!!c.archived}
                    onChange={(e) => db.cards.update(c.id!, { archived: e.target.checked })}
                  />
                  使わない
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'categories' && (
        <div className="card-panel">
          <h2>カテゴリと月予算</h2>
          <p className="hint" style={{ marginBottom: 8 }}>予算はExcelの前年度実績をもとにした初期値です。0 = 予算管理しない。</p>
          <ul className="tx-list">
            {categories.filter((c) => c.kind === 'expense').map((c) => (
              <li key={c.id}>
                <div className="tx-main">
                  <div className="tx-cat">{c.name}</div>
                  <div className="tx-memo">{c.group}</div>
                </div>
                <input
                  type="number"
                  style={{ width: 110, textAlign: 'right', padding: '4px 6px' }}
                  defaultValue={c.budgetMonthly}
                  onBlur={(e) => db.categories.update(c.id!, { budgetMonthly: Number(e.target.value) || 0 })}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === 'backup' && (
        <div className="card-panel">
          <h2>バックアップと復元</h2>
          <p className="hint" style={{ marginBottom: 10 }}>
            データはこの端末のブラウザ内にのみ保存されています。定期的にバックアップを保存し、
            端末を変えるときはファイルから復元してください。
          </p>
          <div className="row">
            <button className="ghost" onClick={exportJson}>バックアップを保存 (JSON)</button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>ファイルから復元</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0] ?? null)} />
          </div>
          {message && <p className="hint" style={{ marginTop: 8 }}>{message}</p>}
          <h3 style={{ marginTop: 16 }}>データの初期化</h3>
          <button
            className="danger-ghost"
            onClick={async () => {
              if (confirm('すべてのデータを削除して初期状態に戻します。よろしいですか?')) {
                await db.delete();
                location.reload();
              }
            }}
          >
            すべてのデータを削除する
          </button>
        </div>
      )}
    </div>
  );
}
