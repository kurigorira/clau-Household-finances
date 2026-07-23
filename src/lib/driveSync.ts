// Googleドライブ同期。
// Google Identity Services (GIS) でアクセストークンを取得し、
// Drive API の appDataFolder (アプリ専用の非公開領域) に同期ファイルを置く。
// 同じGoogleアカウントでログインした端末同士で双方向マージ同期される。

import { exportData, importData, type Snapshot } from './backup';
import { mergeSnapshots } from './merge';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'kurihara-kakeibo-sync.json';
const CLIENT_ID_KEY = 'kakeibo.gdrive.clientId';
const LAST_SYNC_KEY = 'kakeibo.gdrive.lastSyncAt';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? '';
}

export function setClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

export function getLastSyncAt(): string {
  return localStorage.getItem(LAST_SYNC_KEY) ?? '';
}

export function isConnected(): boolean {
  return accessToken != null && Date.now() < tokenExpiresAt;
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Googleログイン用スクリプトを読み込めませんでした (ネットワークを確認してください)'));
    document.head.appendChild(script);
  });
}

async function getToken(clientId: string): Promise<string> {
  if (isConnected()) return accessToken!;
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.access_token) {
          accessToken = resp.access_token;
          tokenExpiresAt = Date.now() + ((resp.expires_in ?? 3600) - 60) * 1000;
          resolve(resp.access_token);
        } else {
          reject(new Error(resp.error ?? 'Googleログインがキャンセルされました'));
        }
      },
      error_callback: (err: { message?: string; type?: string }) => {
        reject(new Error(err.message ?? err.type ?? 'Googleログインに失敗しました'));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const resp = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Google Drive APIエラー (${resp.status}): ${body.slice(0, 200)}`);
  }
  return resp;
}

async function findSyncFile(): Promise<string | null> {
  const q = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
  const resp = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`,
  );
  const data = await resp.json();
  return data.files?.[0]?.id ?? null;
}

async function downloadSnapshot(fileId: string): Promise<Snapshot> {
  const resp = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return (await resp.json()) as Snapshot;
}

async function uploadSnapshot(fileId: string | null, snapshot: Snapshot): Promise<void> {
  const json = JSON.stringify(snapshot);
  if (fileId) {
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
  } else {
    const boundary = '----kakeibo-sync-boundary';
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }
}

export interface SyncResult {
  merged: boolean; // リモートとマージしたか (false = 初回アップロードのみ)
  transactionCount: number;
}

/** 双方向同期: リモートを取得 → マージ → ローカルへ反映 → アップロード */
export async function syncNow(clientId: string): Promise<SyncResult> {
  if (!clientId) throw new Error('クライアントIDを設定してください');
  await getToken(clientId);

  const local = await exportData();
  const fileId = await findSyncFile();

  let result: SyncResult;
  if (fileId) {
    const remote = await downloadSnapshot(fileId);
    const merged = mergeSnapshots(local, remote);
    await importData(merged);
    await uploadSnapshot(fileId, merged);
    result = { merged: true, transactionCount: merged.transactions.length };
  } else {
    await uploadSnapshot(null, local);
    result = { merged: false, transactionCount: local.transactions.length };
  }
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  return result;
}

/** 記帳の追加/削除後に呼ぶ。接続中なら静かに同期し、失敗しても無視 (次回の手動同期で回復する) */
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
export function autoSyncIfConnected(): void {
  if (!isConnected()) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    syncNow(getClientId()).catch(() => {});
  }, 3000);
}
