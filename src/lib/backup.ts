import type { ActivityLog, Comparison, GoodNew, Label, Memo, Template } from '../types'

// v4 でメモをテンプレート式に刷新した。v3 以前のバックアップはメモの構造が
// 根本的に異なるため復元できない(単価計算・日次ログのみ取り込む)
export const SCHEMA_VERSION = 4

export interface BackupFile {
  app: 'life-supporter'
  schemaVersion: number
  exportedAt: string
  memos: Memo[]
  templates: Template[]
  labels: Label[]
  comparisons: Comparison[]
  goodNews: GoodNew[]
  activityLogs: ActivityLog[]
}

export type BackupData = Omit<BackupFile, 'app' | 'schemaVersion' | 'exportedAt'>

export function buildBackup(data: BackupData): BackupFile {
  return {
    app: 'life-supporter',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...data
  }
}

export function backupFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `life-supporter-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export type BackupValidation =
  | { ok: true; data: BackupFile; warning?: string }
  | { ok: false; error: string }

export function validateBackup(text: string): BackupValidation {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSONとして読み込めませんでした。' }
  }
  const d = json as Partial<BackupFile>
  if (d?.app !== 'life-supporter') {
    return { ok: false, error: 'life-supporter のバックアップファイルではありません。' }
  }
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `未対応のスキーマバージョンです(v${d.schemaVersion})。アプリを更新してください。`
    }
  }
  if (!Array.isArray(d.comparisons)) {
    return { ok: false, error: 'ファイルの内容が不完全です。' }
  }

  // 旧バックアップに存在しないストアは空配列に正規化する(この方針は v1 から一貫)
  let warning: string | undefined
  if (d.schemaVersion < SCHEMA_VERSION) {
    // v3 以前のメモは構造が違うので取り込まない。他のデータは活かす
    const droppedMemos = Array.isArray(d.memos) ? d.memos.length : 0
    if (droppedMemos > 0) {
      warning = `旧形式のメモ${droppedMemos}件は、テンプレート式への刷新により復元できませんでした。単価計算と日次ログは取り込みました。`
    }
    d.memos = []
  }
  if (!Array.isArray(d.memos)) d.memos = []
  if (!Array.isArray(d.templates)) d.templates = []
  if (!Array.isArray(d.labels)) d.labels = []
  if (!Array.isArray(d.goodNews)) d.goodNews = []
  if (!Array.isArray(d.activityLogs)) d.activityLogs = []
  return { ok: true, data: d as BackupFile, warning }
}

// Web Share API で共有シートへ。非対応時はダウンロードにフォールバック
export async function shareOrDownload(backup: BackupFile): Promise<'shared' | 'downloaded'> {
  const name = backupFileName()
  const text = JSON.stringify(backup, null, 2)
  const file = new File([text], name, { type: 'application/json' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e
      // 共有に失敗した場合はダウンロードへフォールバック
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
