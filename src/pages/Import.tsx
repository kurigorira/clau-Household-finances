import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newUid, type Transaction } from '../db/schema';
import { decodeCsvFile, guessCategoryName, mfHashOf, parseMfCsv, type MfRow } from '../lib/mfCsv';
import { yen } from '../lib/format';
import { autoSyncIfConnected } from '../lib/driveSync';

interface PreviewRow {
  mf: MfRow;
  hash: string;
  duplicate: boolean;
  categoryId: number | null;
  cardId: number | null;
  selected: boolean;
}

export default function Import() {
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? [];
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? [];

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const incomeCats = categories.filter((c) => c.kind === 'income');
  const fallbackExpense = expenseCats.find((c) => c.name === 'その他支出')?.id ?? expenseCats[0]?.id ?? null;
  const fallbackIncome = incomeCats.find((c) => c.name === 'その他収入')?.id ?? incomeCats[0]?.id ?? null;

  const matchCard = (institution: string): number | null => {
    for (const card of cards) {
      // 「セゾン(剛)」→「セゾン」で機関名と突き合わせ
      const base = card.name.replace(/\(.+\)/, '').replace(/カード/, '');
      if (base && institution.includes(base)) return card.id!;
    }
    return institution.includes('カード') ? -1 : null; // -1 = カードらしいが特定不可
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setDone('');
    try {
      const text = await decodeCsvFile(file);
      const { rows: mfRows, errors: parseErrors } = parseMfCsv(text);
      setErrors(parseErrors);

      const mappings = await db.mfMappings.toArray();
      const mapByKey = new Map(mappings.map((m) => [m.mfKey, m.categoryId]));
      const existingHashes = new Set(
        (await db.transactions.where('mfHash').anyOf(mfRows.map(mfHashOf)).toArray()).map((t) => t.mfHash),
      );

      const preview: PreviewRow[] = mfRows.map((mf) => {
        const hash = mfHashOf(mf);
        const duplicate = existingHashes.has(hash);
        const isIncome = mf.amount > 0;
        const learned = mapByKey.get(`${mf.largeCat}/${mf.middleCat}`);
        const guessName = guessCategoryName(mf.largeCat, mf.middleCat, mf.description);
        const guessed = categories.find((c) => c.name === guessName && c.kind === (isIncome ? 'income' : 'expense'))?.id;
        const categoryId = learned ?? guessed ?? (isIncome ? fallbackIncome : fallbackExpense);
        const cardMatch = isIncome ? null : matchCard(mf.institution);
        return {
          mf,
          hash,
          duplicate,
          categoryId,
          cardId: cardMatch === -1 ? null : cardMatch,
          selected: !duplicate && mf.include && !mf.isTransfer,
        };
      });
      setRows(preview);
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    const targets = rows.filter((r) => r.selected && !r.duplicate && r.categoryId != null);
    if (targets.length === 0) return;
    setBusy(true);
    try {
      const txs: Transaction[] = targets.map((r) => ({
        uid: newUid(),
        date: r.mf.date,
        amount: Math.abs(r.mf.amount),
        kind: r.mf.amount > 0 ? 'income' : 'expense',
        categoryId: r.categoryId!,
        method: r.cardId != null ? 'card' : 'bank',
        cardId: r.cardId ?? undefined,
        memo: [r.mf.description, r.mf.memo].filter(Boolean).join(' / '),
        source: 'mf',
        mfHash: r.hash,
      }));
      await db.transactions.bulkAdd(txs);
      // 大項目/中項目→カテゴリの対応を学習して次回から自動適用
      for (const r of targets) {
        const key = `${r.mf.largeCat}/${r.mf.middleCat}`;
        if (key !== '/') await db.mfMappings.put({ mfKey: key, categoryId: r.categoryId! }).catch(() => {});
      }
      setDone(`${targets.length}件を取り込みました (重複 ${rows.filter((r) => r.duplicate).length}件はスキップ)`);
      setRows([]);
      autoSyncIfConnected();
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i: number, patch: Partial<PreviewRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const selectedCount = rows.filter((r) => r.selected && !r.duplicate).length;

  return (
    <div>
      <div className="card-panel">
        <h2>マネーフォワードCSV取込</h2>
        <p className="hint" style={{ marginBottom: 8 }}>
          マネーフォワードMEの「家計簿 → 月次推移/履歴のダウンロード(CSV)」で保存したファイルを選択してください。
          金融機関連携で取得された明細(カード利用・口座引落)を重複なく取り込みます。
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {busy && <p className="hint">処理中…</p>}
        {done && <p className="hint" style={{ color: 'var(--green)' }}>✓ {done}</p>}
        {errors.map((e, i) => (
          <p key={i} className="error-text">{e}</p>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="card-panel">
          <div className="row spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>プレビュー ({rows.length}件)</h2>
            <button className="primary" style={{ width: 'auto', padding: '8px 16px' }} disabled={selectedCount === 0 || busy} onClick={register}>
              {selectedCount}件を取り込む
            </button>
          </div>
          <div className="import-preview">
            <ul className="tx-list">
              {rows.map((r, i) => (
                <li key={r.hash + i} style={{ opacity: r.duplicate ? 0.45 : 1 }}>
                  <input
                    type="checkbox"
                    checked={r.selected && !r.duplicate}
                    disabled={r.duplicate}
                    onChange={(e) => setRow(i, { selected: e.target.checked })}
                  />
                  <span className="tx-date">{r.mf.date.slice(5).replace('-', '/')}</span>
                  <div className="tx-main">
                    <div className="tx-memo">
                      {r.mf.description} <span className="hint">({r.mf.institution})</span>
                      {r.duplicate && <span className="badge warn"> 取込済み</span>}
                      {r.mf.isTransfer && <span className="badge warn"> 振替</span>}
                    </div>
                    <select
                      value={r.categoryId ?? ''}
                      onChange={(e) => setRow(i, { categoryId: Number(e.target.value) })}
                      style={{ fontSize: '0.78rem', padding: '3px 6px', marginTop: 2 }}
                    >
                      {(r.mf.amount > 0 ? incomeCats : expenseCats).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <span className={`tx-amount ${r.mf.amount > 0 ? 'income' : 'expense'}`}>
                    {r.mf.amount > 0 ? '+' : '−'}{yen(Math.abs(r.mf.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            カテゴリはマネーフォワードの項目から自動推定しています。修正して取り込むと学習し、次回から自動で反映されます。
          </p>
        </div>
      )}
    </div>
  );
}
