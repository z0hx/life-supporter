import { useMemo, useState } from 'react'
import type { DailyLogEntry } from '../types'
import { formatDayLabel, relativeTime } from '../lib/format'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'

interface DayGroup {
  key: number
  label: string
  entries: DailyLogEntry[]
}

// createdAt のカレンダー日ごとにまとめる(新しい日が先頭)
function groupByDay(entries: DailyLogEntry[]): DayGroup[] {
  const startOfDay = (ts: number) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const groups: DayGroup[] = []
  const index = new Map<number, DayGroup>()
  for (const e of entries) {
    const key = startOfDay(e.createdAt)
    let g = index.get(key)
    if (!g) {
      g = { key, label: formatDayLabel(e.createdAt), entries: [] }
      index.set(key, g)
      groups.push(g)
    }
    g.entries.push(e)
  }
  return groups
}

export interface DailyLogScreenProps {
  navigate: (r: string) => void
  title: string
  placeholder: string
  addedToast: string
  deleteMessage: string
  emptyMessage: string
  entries: DailyLogEntry[]
  onAdd: (text: string) => Promise<unknown>
  onUpdate: (id: string, text: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

// Good & New / 行動記録 が共有する、日ごとの自由記述ログ画面
export function DailyLogScreen({
  navigate,
  title,
  placeholder,
  addedToast,
  deleteMessage,
  emptyMessage,
  entries,
  onAdd,
  onUpdate,
  onRemove
}: DailyLogScreenProps) {
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<DailyLogEntry | null>(null)

  const groups = useMemo(() => groupByDay(entries), [entries])

  const add = async () => {
    const text = draft.trim()
    if (!text) return
    await onAdd(text)
    setDraft('')
    toast(addedToast)
  }

  const startEdit = (entry: DailyLogEntry) => {
    setEditingId(entry.id)
    setEditText(entry.text)
  }

  const saveEdit = async (entry: DailyLogEntry) => {
    const text = editText.trim()
    setEditingId(null)
    if (!text || text === entry.text) return
    await onUpdate(entry.id, text)
    toast('更新しました')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="ホームへ戻る" onClick={() => navigate('/')}>
          ‹
        </button>
        <h1 className="screen-title">{title}</h1>
      </header>

      <div className="daylog-composer">
        <textarea
          className="note-input"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="daylog-add" disabled={!draft.trim()} onClick={add}>
          記録する
        </button>
      </div>

      <div className="list-body">
        {groups.length === 0 && <div className="daylog-empty">{emptyMessage}</div>}
        {groups.map((g) => (
          <section key={g.key}>
            <div className="daylog-day">{g.label}</div>
            <div className="plain-card">
              {g.entries.map((entry) => (
                <div key={entry.id} className="daylog-row">
                  {editingId === entry.id ? (
                    <div className="daylog-edit">
                      <textarea
                        className="note-input"
                        value={editText}
                        autoFocus
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="daylog-edit-actions">
                        <button className="daylog-edit-cancel" onClick={() => setEditingId(null)}>
                          キャンセル
                        </button>
                        <button
                          className="daylog-edit-save"
                          disabled={!editText.trim()}
                          onClick={() => saveEdit(entry)}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button className="daylog-body" onClick={() => startEdit(entry)}>
                        <div className="daylog-text">{entry.text}</div>
                        <div className="daylog-time">{relativeTime(entry.updatedAt)}</div>
                      </button>
                      <button
                        className="row-delete-btn"
                        aria-label="この記録を削除"
                        onClick={() => setConfirmDelete(entry)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {confirmDelete && (
        <Dialog
          title="記録を削除"
          message={deleteMessage}
          onClose={() => setConfirmDelete(null)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await onRemove(confirmDelete.id)
                setConfirmDelete(null)
                toast('削除しました')
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setConfirmDelete(null) }
          ]}
        />
      )}
    </div>
  )
}
