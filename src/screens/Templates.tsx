import { useState } from 'react'
import type { FieldKind, Template, TemplateField } from '../types'
import { useStore } from '../store'
import { FieldConfigInput, createTemplateField, fieldMeta } from '../fields'
import { labelStyle } from '../lib/memoGroups'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { FieldPicker } from './MemoEditor'

export function TemplateList({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null)

  if (editing) {
    return (
      <TemplateEditor
        template={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="メモへ戻る" onClick={() => navigate('/memos')}>
          ‹
        </button>
        <h1 className="screen-title">テンプレート</h1>
      </header>

      <div className="memo-scroll">
        <p className="screen-note">
          メモの項目構成を決める型紙です。テンプレートを変更しても、すでに作ったメモはそのまま残ります。
        </p>
        <div className="memo-card">
          {store.templates.map((t) => (
            <div key={t.id} className="template-row">
              <button className="template-main" onClick={() => setEditing(t)}>
                <span className="template-emoji">{t.emoji ?? '📝'}</span>
                <span className="template-text">
                  <b>{t.name}</b>
                  <span>
                    {t.fields.length > 0
                      ? t.fields.map((f) => fieldMeta(f.kind).name).join('・')
                      : '項目なし'}
                  </span>
                </span>
              </button>
              <button
                className="template-action"
                aria-label={`${t.name} を複製`}
                onClick={async () => {
                  await store.duplicateTemplate(t.id)
                  toast('テンプレートを複製しました')
                }}
              >
                ⧉
              </button>
              <button
                className="template-action"
                aria-label={`${t.name} を削除`}
                onClick={() => setConfirmDelete(t)}
              >
                ✕
              </button>
            </div>
          ))}
          {store.templates.length === 0 && (
            <div className="memo-empty">テンプレートがありません</div>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => setEditing('new')}>
        ＋ テンプレートを作る
      </button>

      {confirmDelete && (
        <Dialog
          title="テンプレートを削除"
          message={`「${confirmDelete.name}」を削除します。このテンプレートから作ったメモは残ります。`}
          onClose={() => setConfirmDelete(null)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.removeTemplate(confirmDelete.id)
                setConfirmDelete(null)
                toast('テンプレートを削除しました')
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setConfirmDelete(null) }
          ]}
        />
      )}
    </div>
  )
}

function TemplateEditor({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [name, setName] = useState(template?.name ?? '')
  const [emoji, setEmoji] = useState(template?.emoji ?? '📝')
  const [description, setDescription] = useState(template?.description ?? '')
  const [fields, setFields] = useState<TemplateField[]>(template?.fields ?? [])
  const [defaultLabels, setDefaultLabels] = useState<string[]>(template?.defaultLabels ?? [])
  const [addingField, setAddingField] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const canSave = name.trim().length > 0

  const patchField = (next: TemplateField) =>
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
    const f = createTemplateField(kind)
    setFields((prev) => [...prev, f])
    setAddingField(false)
    setExpanded(f.id)
  }

  const save = async () => {
    if (!canSave) return
    const payload = {
      name: name.trim(),
      emoji: emoji.trim() || undefined,
      description: description.trim() || undefined,
      fields,
      defaultLabels
    }
    if (template) {
      await store.updateTemplate(template.id, payload)
      toast('テンプレートを更新しました')
    } else {
      await store.addTemplate(payload)
      toast('テンプレートを作成しました')
    }
    onClose()
  }

  return (
    <div className="screen editor-screen">
      <header className="modal-header">
        <button className="modal-cancel" onClick={onClose}>
          キャンセル
        </button>
        <span className="modal-title">
          {template ? 'テンプレートを編集' : 'テンプレートを作る'}
        </span>
        <button className="modal-save" disabled={!canSave} onClick={save}>
          保存
        </button>
      </header>

      <div className="editor-body">
        <div className="field-row">
          <input
            className="field-input field-input--emoji"
            value={emoji}
            aria-label="アイコン"
            onChange={(e) => setEmoji(e.target.value)}
          />
          <input
            className="title-input"
            placeholder="テンプレート名(例:行きたい店)"
            value={name}
            autoFocus={!template}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <div className="field-label">説明(任意)</div>
          <input
            className="field-input"
            placeholder="どんなときに使うか"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <div className="field-label">最初から付けるラベル</div>
          <div className="chips">
            {store.labels.map((l) => {
              const on = defaultLabels.includes(l.id)
              return (
                <button
                  key={l.id}
                  className={`chip${on ? ' chip--selected' : ''}`}
                  style={on ? undefined : { color: l.color ?? labelStyle(l.id).color }}
                  aria-pressed={on}
                  onClick={() =>
                    setDefaultLabels((prev) =>
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
            {store.labels.length === 0 && (
              <span className="field-hint">設定画面でラベルを作れます</span>
            )}
          </div>
        </div>

        <div className="field-label">項目({fields.length})</div>
        {fields.length === 0 && (
          <div className="field-hint">まだ項目がありません。下から追加してください</div>
        )}

        {fields.map((f, i) => {
          const meta = fieldMeta(f.kind)
          const open = expanded === f.id
          return (
            <div key={f.id} className="tfield">
              <div className="tfield-head">
                <span className="tfield-icon">{meta.icon}</span>
                <input
                  className="field-input field-input--label"
                  value={f.label}
                  onChange={(e) => patchField({ ...f, label: e.target.value })}
                />
                <div className="editor-field-tools">
                  <button aria-label="上へ移動" disabled={i === 0} onClick={() => moveField(f.id, -1)}>
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
              </div>
              <button className="tfield-toggle" onClick={() => setExpanded(open ? null : f.id)}>
                {meta.name}
                <span className={`chevron${open ? '' : ' chevron--collapsed'}`}>▾</span>
              </button>
              {open && (
                <div className="tfield-config">
                  <label className="field-config-row field-config-row--check">
                    <input
                      type="checkbox"
                      checked={f.required ?? false}
                      onChange={(e) => patchField({ ...f, required: e.target.checked })}
                    />
                    <span>入力必須にする</span>
                  </label>
                  <FieldConfigInput field={f} onChange={patchField} />
                </div>
              )}
            </div>
          )
        })}

        <button className="editor-add-field" onClick={() => setAddingField(true)}>
          ＋ 項目を追加
        </button>
      </div>

      {addingField && <FieldPicker onPick={addField} onClose={() => setAddingField(false)} />}
    </div>
  )
}
