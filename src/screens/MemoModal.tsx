import { useMemo, useRef, useState } from 'react'
import type { Memo, Priority } from '../types'
import { useStore } from '../store'
import { collectTags, tagStyle } from '../lib/memoGroups'
import { formatDateTime } from '../lib/format'
import { Segmented } from '../components/Segmented'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'

export function MemoModal({ memo, onClose }: { memo: Memo | null; onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [title, setTitle] = useState(memo?.title ?? '')
  const [category, setCategory] = useState(memo?.category ?? store.categories[0]?.id ?? 'other')
  const [tags, setTags] = useState<string[]>(memo?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [priority, setPriority] = useState<Priority>(memo?.priority ?? 'normal')
  const [note, setNote] = useState(memo?.note ?? '')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const existingTags = useMemo(
    () => collectTags(store.memos).filter((t) => !tags.includes(t)),
    [store.memos, tags]
  )

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, '')
    if (!t) return
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]))
    setTagInput('')
  }

  const save = async () => {
    const t = title.trim()
    if (!t) return
    // 入力途中のタグも取りこぼさない
    const finalTags = tagInput.trim() ? [...tags, tagInput.trim().replace(/^#/, '')] : tags
    if (memo) {
      await store.updateMemo(memo.id, {
        title: t,
        category,
        tags: [...new Set(finalTags)],
        priority,
        note: note.trim() || undefined
      })
      toast('メモを更新しました')
    } else {
      await store.addMemo({
        title: t,
        category,
        tags: [...new Set(finalTags)],
        priority,
        note: note.trim() || undefined
      })
      toast('メモを追加しました')
    }
    onClose()
  }

  const confirmNewCategory = async () => {
    const label = newCategoryLabel.trim()
    setAddingCategory(false)
    setNewCategoryLabel('')
    if (!label) return
    const cat = await store.addCategory(label)
    setCategory(cat.id)
  }

  return (
    <>
      <div className="modal-overlay" />
      <div className="modal" role="dialog" aria-label={memo ? 'メモを編集' : 'メモを追加'}>
        <header className="modal-header">
          <button className="modal-cancel" onClick={onClose}>
            キャンセル
          </button>
          <span className="modal-title">{memo ? 'メモを編集' : 'メモを追加'}</span>
          <button className="modal-save" disabled={!title.trim()} onClick={save}>
            保存
          </button>
        </header>
        <div className="modal-body">
          <input
            className="title-input"
            placeholder="タイトル(例:代々木のカレー店)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div>
            <div className="field-label">カテゴリ(1つ選択)</div>
            <div className="chips">
              {store.categories.map((c) => {
                const selected = c.id === category
                return (
                  <button
                    key={c.id}
                    className={`chip${selected ? ' chip--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.emoji ? `${c.emoji} ` : ''}
                    {c.label}
                    {selected ? ' ✓' : ''}
                  </button>
                )
              })}
              {addingCategory ? (
                <input
                  className="chip-input"
                  placeholder="カテゴリ名"
                  value={newCategoryLabel}
                  autoFocus
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  onBlur={confirmNewCategory}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmNewCategory()
                    if (e.key === 'Escape') {
                      setAddingCategory(false)
                      setNewCategoryLabel('')
                    }
                  }}
                />
              ) : (
                <button className="chip chip--dashed" onClick={() => setAddingCategory(true)}>
                  ＋ 追加
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="field-label">タグ(複数可)</div>
            <div className="tag-box" onClick={() => tagInputRef.current?.focus()}>
              {tags.map((t) => (
                <button
                  key={t}
                  className="tag-chip"
                  style={{ color: tagStyle(t).color, background: tagStyle(t).bg }}
                  aria-label={`タグ ${t} を外す`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTags((prev) => prev.filter((x) => x !== t))
                  }}
                >
                  #{t} ✕
                </button>
              ))}
              <input
                ref={tagInputRef}
                className="tag-input"
                placeholder={tags.length === 0 ? 'タグを入力…' : ''}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTag(tagInput)
                  } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                    setTags((prev) => prev.slice(0, -1))
                  }
                }}
                onBlur={() => addTag(tagInput)}
              />
            </div>
            {existingTags.length > 0 && (
              <div className="tag-suggests">
                {existingTags.slice(0, 10).map((t) => (
                  <button key={t} className="tag-suggest" onClick={() => addTag(t)}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="field-label">優先度</div>
            <div style={{ width: 190 }}>
              <Segmented
                fill
                light
                options={[
                  { value: 'normal', label: 'ふつう' },
                  { value: 'high', label: '高' }
                ]}
                value={priority}
                onChange={setPriority}
              />
            </div>
          </div>

          <div>
            <div className="field-label">補足メモ(任意)</div>
            <textarea
              className="note-input"
              placeholder="出典やURL、営業時間など…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="modal-dates">
            作成 {formatDateTime(memo?.createdAt ?? Date.now())} · 更新{' '}
            {memo ? formatDateTime(memo.updatedAt) : '—'}
          </div>

          {memo && (
            <button className="modal-delete" onClick={() => setConfirmDelete(true)}>
              このメモを削除
            </button>
          )}
        </div>
      </div>

      {confirmDelete && memo && (
        <Dialog
          title="メモを削除"
          message={`「${memo.title}」を削除します。よろしいですか?`}
          onClose={() => setConfirmDelete(false)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.removeMemo(memo.id)
                toast('メモを削除しました')
                onClose()
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setConfirmDelete(false) }
          ]}
        />
      )}
    </>
  )
}
