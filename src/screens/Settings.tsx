import { useRef, useState } from 'react'
import { needsBackupReminder, useStore } from '../store'
import { buildBackup, shareOrDownload, validateBackup, type BackupFile } from '../lib/backup'
import type { DataSet } from '../lib/db'
import { formatDate } from '../lib/format'
import { Dialog } from '../components/Dialog'
import { Segmented } from '../components/Segmented'
import { useToast } from '../components/Toast'

const ARCHIVE_OPTIONS = [
  { value: '7', label: '7日' },
  { value: '30', label: '30日' },
  { value: '90', label: '90日' },
  { value: '0', label: 'しない' }
] as const

function counts(d: DataSet) {
  return `メモ ${d.memos.length}件 / テンプレート ${d.templates.length}件 / ラベル ${d.labels.length}件 / 比較履歴 ${d.comparisons.length}件 / Good & New ${d.goodNews.length}件 / 行動記録 ${d.activityLogs.length}件 / 商品 ${d.products.length}件 / 価格記録 ${d.priceRecords.length}件`
}

export function Settings({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [newLabel, setNewLabel] = useState('')
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null)
  const [importWarning, setImportWarning] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [confirmErase, setConfirmErase] = useState(false)

  const dataSet = (): DataSet => ({
    memos: store.memos,
    templates: store.templates,
    labels: store.labels,
    comparisons: store.comparisons,
    goodNews: store.goodNews,
    activityLogs: store.activityLogs,
    products: store.products,
    priceRecords: store.priceRecords
  })

  const doExport = async () => {
    try {
      const result = await shareOrDownload(buildBackup(dataSet()))
      await store.markExported()
      toast(
        result === 'shared'
          ? '共有シートからバックアップを送信しました'
          : 'バックアップをダウンロードしました'
      )
    } catch {
      // 共有シートをキャンセルした場合など
    }
  }

  const onFileSelected = async (file: File) => {
    const result = validateBackup(await file.text())
    if (!result.ok) {
      setImportResult(result.error)
      return
    }
    setImportWarning(result.warning ?? null)
    setPendingImport(result.data)
  }

  const applyImport = async (mode: 'replace' | 'merge') => {
    const d = pendingImport!
    setPendingImport(null)
    const data: DataSet = {
      memos: d.memos,
      templates: d.templates,
      labels: d.labels,
      comparisons: d.comparisons,
      goodNews: d.goodNews,
      activityLogs: d.activityLogs,
      products: d.products,
      priceRecords: d.priceRecords
    }
    if (mode === 'replace') {
      await store.importReplace(data)
    } else {
      await store.importMerge(data)
    }
    setImportResult(
      `インポートが完了しました。\n${counts(data)}${importWarning ? `\n\n${importWarning}` : ''}`
    )
    setImportWarning(null)
  }

  const addLabel = async () => {
    const name = newLabel.trim()
    if (!name) return
    await store.addLabel(name)
    setNewLabel('')
    toast('ラベルを追加しました')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="ホームへ戻る" onClick={() => navigate('/')}>
          ‹
        </button>
        <h1 className="screen-title">設定</h1>
      </header>

      <div className="list-body">
        {needsBackupReminder(store) && (
          <div className="reminder-banner">
            <span aria-hidden="true">💾</span>
            <span>
              {store.lastExportAt
                ? `最後のバックアップから90日以上経っています(前回 ${formatDate(store.lastExportAt)})。エクスポートをおすすめします。`
                : 'まだバックアップがありません。データを守るためにエクスポートしておきましょう。'}
            </span>
          </div>
        )}

        <section>
          <div className="section-title">メモ</div>
          <div className="plain-card">
            <button className="list-row" onClick={() => navigate('/templates')}>
              <div className="list-row-main">
                <div className="list-row-title">テンプレート管理</div>
                <div className="list-row-sub">
                  {store.templates.length}件 · メモの項目構成を決める型紙
                </div>
              </div>
              <span className="list-row-side">→</span>
            </button>
          </div>
        </section>

        <section>
          <div className="section-title">ラベル管理</div>
          <div className="plain-card">
            {store.labels.map((l) => (
              <div key={l.id} className="list-row">
                <input
                  className="label-emoji-input"
                  value={l.emoji ?? ''}
                  aria-label={`${l.name} のアイコン`}
                  placeholder="🏷"
                  onChange={(e) => store.updateLabel(l.id, { emoji: e.target.value || undefined })}
                />
                <input
                  className="label-name-input"
                  value={l.name}
                  aria-label="ラベル名"
                  onChange={(e) => store.updateLabel(l.id, { name: e.target.value })}
                />
                <button
                  className="row-delete-btn"
                  aria-label={`ラベル ${l.name} を削除`}
                  onClick={async () => {
                    await store.removeLabel(l.id)
                    toast('ラベルを削除しました(メモは残ります)')
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="add-category-row">
              <input
                className="add-category-input"
                placeholder="新しいラベル名"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLabel()
                }}
              />
              <button className="add-category-btn" onClick={addLabel}>
                ＋ 追加
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="section-title">アーカイブ</div>
          <div className="plain-card" style={{ padding: '14px 16px' }}>
            <div className="list-row-title" style={{ marginBottom: 10 }}>
              完了済みメモを自動アーカイブ
            </div>
            <Segmented
              fill
              light
              options={ARCHIVE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={String(store.archiveDays) as (typeof ARCHIVE_OPTIONS)[number]['value']}
              onChange={(v) => store.setArchiveDays(Number(v))}
            />
            <div className="settings-note">
              完了からこの日数が経ったメモを一覧から自動的に片づけます。データは残り、エクスポートに含まれます。
            </div>
          </div>
        </section>

        <section>
          <div className="section-title">データ</div>
          <div className="plain-card">
            <button className="list-row" onClick={doExport}>
              <div className="list-row-main">
                <div className="list-row-title">エクスポート(JSON)</div>
                <div className="list-row-sub">
                  {store.lastExportAt
                    ? `前回: ${formatDate(store.lastExportAt)}`
                    : '共有シートまたはダウンロードで書き出し'}
                </div>
              </div>
              <span className="list-row-side">→</span>
            </button>
            <button className="list-row" onClick={() => fileRef.current?.click()}>
              <div className="list-row-main">
                <div className="list-row-title">インポート</div>
                <div className="list-row-sub">バックアップファイル(.json)から復元</div>
              </div>
              <span className="list-row-side">→</span>
            </button>
            <button className="list-row" onClick={() => setConfirmErase(true)}>
              <div className="list-row-main">
                <div className="list-row-title danger-text">すべてのデータを削除</div>
              </div>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onFileSelected(f)
            }}
          />
        </section>

        <div className="settings-version">life-supporter v2.0 · ローカルに保存されます</div>
      </div>

      {pendingImport && (
        <Dialog
          title="インポート方法を選択"
          message={`ファイルの内容:${counts(pendingImport)}${importWarning ? `\n\n⚠️ ${importWarning}` : ''}`}
          onClose={() => setPendingImport(null)}
          actions={[
            {
              label: '置き換え(今のデータを消して復元)',
              style: 'dark',
              onClick: () => applyImport('replace')
            },
            { label: '追記(マージ)', style: 'primary', onClick: () => applyImport('merge') },
            { label: 'キャンセル', style: 'ghost', onClick: () => setPendingImport(null) }
          ]}
        />
      )}

      {importResult && (
        <Dialog
          title="インポート"
          message={importResult}
          onClose={() => setImportResult(null)}
          actions={[{ label: 'OK', style: 'dark', onClick: () => setImportResult(null) }]}
        />
      )}

      {confirmErase && (
        <Dialog
          title="すべてのデータを削除"
          message="メモ・テンプレート・ラベル・比較履歴・Good & New・行動記録・商品と価格記録 をすべて削除します。この操作は取り消せません。"
          onClose={() => setConfirmErase(false)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.eraseAll()
                setConfirmErase(false)
                toast('すべてのデータを削除しました')
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setConfirmErase(false) }
          ]}
        />
      )}
    </div>
  )
}
