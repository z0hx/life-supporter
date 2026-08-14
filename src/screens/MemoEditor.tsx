import { useMemo, useState } from 'react'
import type { FieldKind, Memo, MemoField, Priority } from '../types'
import { useStore, type MemoDraft } from '../store'
import { FIELD_ORDER, FieldInput, createMemoField, fieldMeta } from '../fields'
import { labelStyle } from '../lib/memoGroups'
import { formatDateTime } from '../lib/format'
import { Segmented } from '../components/Segmented'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'

export function MemoEditor({
  memo,
  draft,
  onClose
}: {
  /** 既存メモを編集する場合 */
  memo?: Memo
  /** 新規作成する場合(テンプレートから作った下書き) */
  draft?: MemoDraft
  onClose: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const source = memo ?? draft!

  const [title, setTitle] = useState(source.title)
  const [labels, setLabels] = useState<string[]>(source.labels)
  const [priority, setPriority] = useState<Priority>(source.priority)
  const [fields, setFields] = useState<MemoField[]>(source.fields)
  const [editingFields, setEditingFields] = useState(false)
  const [addingField, setAddingField] = useState(false)
  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [keepValues, setKeepValues] = useState(false)

  const canSave = title.trim().length > 0

  const patchField = (next: MemoField) =>
    setFields((prev) => prev.map((f) => (f.id === next.id ? next : f)))

  const moveField = (id: string, delta: number) =>
    setFields((prev) => {
      const from = prev.findIndex((f) => f.id === id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  const addField = (kind: FieldKind) => {
    setFields((prev) => [...prev, createMemoField(kind)])
    setAddingField(false)
    setEditingFields(true)
  }

  const confirmNewLabel = async () => {
    const name = newLabelName.trim()
    setAddingLabel(false)
    setNewLabelName('')
    if (!name) return
    const existing = store.labels.find((l) => l.name === name)
    const label = existing ?? (await store.addLabel(name))
    setLabels((prev) => (prev.includes(label.id) ? prev : [...prev, label.id]))
  }

  const save = async () => {
    if (!canSave) return
    const payload = { title: title.trim(), labels, priority, fields }
    if (memo) {
      await store.updateMemo(memo.id, payload)
      toast('メモを更新しました')
    } else {
      await store.addMemo({
        ...draft!,
        ...payload
      })
      toast('メモを追加しました')
    }
    onClose()
  }

  // メモの構成をテンプレートとして保存(要件7)
  const saveAsTemplate = async () => {
    const name = templateName.trim()
    if (!name) return
    await store.templateFromMemo({ fields, labels }, name, keepValues)
    setSavingTemplate(false)
    setTemplateName('')
    toast(`テンプレート「${name}」を保存しました`)
  }

  const templateLabel = memo?.templateName ?? draft?.templateName ?? ''

  return (
    <div className="screen editor-screen">
      <header className="modal-header">
        <button className="modal-cancel" onClick={onClose}>
          キャンセル
        </button>
        <span className="modal-title">{memo ? 'メモを編集' : 'メモを追加'}</span>
        <button className="modal-save" disabled={!canSave} onClick={save}>
          保存
        </button>
      </header>

      <div className="editor-body">
        {templateLabel && <div className="editor-template">📋 {templateLabel}</div>}

        <input
          className="title-input"
          placeholder="タイトル(例:代々木のカレー店)"
          value={title}
          autoFocus={!memo}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div>
          <div className="field-label">ラベル(複数可)</div>
          <div className="chips">
            {store.labels.map((l) => {
              const on = labels.includes(l.id)
              const style = l.color ? { color: l.color } : { color: labelStyle(l.id).color }
              return (
                <button
                  key={l.id}
                  className={`chip${on ? ' chip--selected' : ''}`}
                  style={on ? undefined : style}
                  aria-pressed={on}
                  onClick={() =>
                    setLabels((prev) =>
                      prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                    )
                  }
                >
                  {l.emoji ? `${l.emoji} ` : ''}
                  {l.name}
                  {on ? ' ✓' : ''}
                </button>
              )
            })}
            {addingLabel ? (
              <input
                className="chip-input"
                placeholder="ラベル名"
                value={newLabelName}
                autoFocus
                onChange={(e) => setNewLabelName(e.target.value)}
                onBlur={confirmNewLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmNewLabel()
                  if (e.key === 'Escape') {
                    setAddingLabel(false)
                    setNewLabelName('')
                  }
                }}
              />
            ) : (
              <button className="chip chip--dashed" onClick={() => setAddingLabel(true)}>
                ＋ 追加
              </button>
            )}
          </div>
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

        <div className="editor-fields-head">
          <span className="field-label">項目</span>
          <button className="link-btn" onClick={() => setEditingFields((v) => !v)}>
            {editingFields ? '完了' : '項目を編集'}
          </button>
        </div>

        {fields.length === 0 && (
          <div className="field-hint">項目がありません。下の「項目を追加」から足せます</div>
        )}

        {fields.map((f, i) =>
          f.kind === 'heading' && !editingFields ? (
            <div key={f.id} className="editor-heading">
              {f.label}
            </div>
          ) : (
            <div key={f.id} className="editor-field">
              <div className="editor-field-head">
                {editingFields ? (
                  <input
                    className="field-input field-input--label"
                    value={f.label}
                    onChange={(e) => patchField({ ...f, label: e.target.value })}
                  />
                ) : (
                  <span className="field-label">{f.label}</span>
                )}
                {editingFields && (
                  <div className="editor-field-tools">
                    <button
                      aria-label="上へ移動"
                      disabled={i === 0}
                      onClick={() => moveField(f.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      aria-label="下へ移動"
                      disabled={i === fields.length - 1}
                      onClick={() => moveField(f.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      aria-label="この項目を削除"
                      onClick={() => setFields((prev) => prev.filter((x) => x.id !== f.id))}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {f.kind !== 'heading' && <FieldInput field={f} onChange={patchField} />}
            </div>
          )
        )}

        <button className="editor-add-field" onClick={() => setAddingField(true)}>
          ＋ 項目を追加
        </button>

        <div className="modal-dates">
          作成 {formatDateTime(memo?.createdAt ?? Date.now())} · 更新{' '}
          {memo ? formatDateTime(memo.updatedAt) : '—'}
        </div>

        <button
          className="editor-secondary"
          onClick={() => {
            setTemplateName(title.trim() || templateLabel || '新しいテンプレート')
            setSavingTemplate(true)
          }}
        >
          このメモをテンプレートとして保存
        </button>

        {memo && (
          <button className="modal-delete" onClick={() => setConfirmDelete(true)}>
            このメモを削除
          </button>
        )}
      </div>

      {addingField && <FieldPicker onPick={addField} onClose={() => setAddingField(false)} />}

      {savingTemplate && (
        <Dialog
          title="テンプレートとして保存"
          message="このメモの項目構成を、次から使えるテンプレートにします。"
          onClose={() => setSavingTemplate(false)}
          actions={[
            { label: '保存する', style: 'primary', onClick: saveAsTemplate },
            { label: 'キャンセル', style: 'ghost', onClick: () => setSavingTemplate(false) }
          ]}
        >
          <input
            className="field-input"
            value={templateName}
            autoFocus
            placeholder="テンプレート名"
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <label className="field-config-row field-config-row--check">
            <input
              type="checkbox"
              checked={keepValues}
              onChange={(e) => setKeepValues(e.target.checked)}
            />
            <span>いまの入力値を初期値として残す</span>
          </label>
        </Dialog>
      )}

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
    </div>
  )
}

// 追加できるコンポーネントの一覧(Tier 1 が先)
export function FieldPicker({
  onPick,
  onClose
}: {
  onPick: (kind: FieldKind) => void
  onClose: () => void
}) {
  const items = useMemo(() => FIELD_ORDER.map((kind) => ({ kind, ...fieldMeta(kind) })), [])
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="項目を追加">
        <div className="sheet-title">項目を追加</div>
        <div className="sheet-list">
          {items.map((it) => (
            <button key={it.kind} onClick={() => onPick(it.kind)}>
              <span className="sheet-icon">{it.icon}</span>
              <span className="sheet-text">
                <b>{it.name}</b>
                <span>{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
