import type { ActivityLog, Category, Comparison, GoodNew, Memo } from '../types'

export const SCHEMA_VERSION = 3

export interface BackupFile {
  app: 'life-supporter'
  schemaVersion: number
  exportedAt: string
  memos: Memo[]
  comparisons: Comparison[]
  categories: Category[]
  goodNews: GoodNew[]
  activityLogs: ActivityLog[]
}

export function buildBackup(
  memos: Memo[],
  comparisons: Comparison[],
  categories: Category[],
  goodNews: GoodNew[],
  activityLogs: ActivityLog[]
): BackupFile {
  return {
    app: 'life-supporter',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    memos,
    comparisons,
    categories,
    goodNews,
    activityLogs
  }
}

export function backupFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `life-supporter-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export type BackupValidation =
  | { ok: true; data: BackupFile }
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
  if (!Array.isArray(d.memos) || !Array.isArray(d.comparisons) || !Array.isArray(d.categories)) {
    return { ok: false, error: 'ファイルの内容が不完全です。' }
  }
  // 旧バックアップに存在しないストアは空配列に正規化(v1: goodNews 無し / v1・v2: activityLogs 無し)
  if (!Array.isArray(d.goodNews)) d.goodNews = []
  if (!Array.isArray(d.activityLogs)) d.activityLogs = []
  return { ok: true, data: d as BackupFile }
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
