import { useEffect, useRef, useState } from 'react'
import type { ChecklistItem } from '../types'
import { uid } from '../lib/format'
import { RoundCheck } from '../components/RoundCheck'
import type { FieldDef, FieldInputProps } from './types'

function ChecklistInput({ field, onChange }: FieldInputProps<'checklist'>) {
  const items = field.value
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const [focusId, setFocusId] = useState<string | null>(null)

  // 追加した行に入力を続けられるようにする。
  // 描画が確定してからフォーカスする必要があるので effect で行う
  useEffect(() => {
    if (!focusId) return
    inputs.current.get(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  const patch = (id: string, p: Partial<ChecklistItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)))

  const add = () => {
    const item: ChecklistItem = { id: uid(), text: '', checked: false }
    onChange([...items, item])
    setFocusId(item.id)
  }

  return (
    <div className="checklist">
      {items.map((it, i) => (
        <div key={it.id} className={`checklist-row${it.checked ? ' checklist-row--done' : ''}`}>
          <RoundCheck
            done={it.checked}
            onToggle={() => patch(it.id, { checked: !it.checked })}
            label={it.text || `${i + 1}番目の項目`}
          />
          <input
            ref={(el) => {
              if (el) inputs.current.set(it.id, el)
              else inputs.current.delete(it.id)
            }}
            className="checklist-text"
            value={it.text}
            placeholder="項目を入力…"
            onChange={(e) => patch(it.id, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              } else if (e.key === 'Backspace' && !it.text && items.length > 1) {
                e.preventDefault()
                onChange(items.filter((x) => x.id !== it.id))
              }
            }}
          />
          <button
            className="checklist-remove"
            aria-label="この項目を削除"
            onClick={() => onChange(items.filter((x) => x.id !== it.id))}
          >
            ✕
          </button>
        </div>
      ))}
      {field.config.allowAdd && (
        <button className="checklist-add" onClick={add}>
          ＋ 項目を追加
        </button>
      )}
    </div>
  )
}

export const checklistDef: FieldDef<'checklist'> = {
  kind: 'checklist',
  name: 'チェックリスト',
  icon: '☑️',
  hint: '買うもの・持ち物・準備。項目ごとにチェックできる',
  tier: 1,
  createConfig: () => ({ allowAdd: true }),
  createValue: () => [],
  Input: ChecklistInput,
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row field-config-row--check">
      <input
        type="checkbox"
        checked={field.config.allowAdd}
        onChange={(e) => onChange({ ...field.config, allowAdd: e.target.checked })}
      />
      <span>メモ側で項目を追加できる</span>
    </label>
  ),
  summarize: (f) => {
    if (f.value.length === 0) return ''
    return `${f.value.filter((i) => i.checked).length}/${f.value.length}`
  },
  searchText: (f) => f.value.map((i) => i.text).join(' '),
  isEmpty: (f) => f.value.length === 0,
  // テンプレート化するときはチェック状態を落とす。
  // 定番の買い物リストを作り直すたびに全部チェック済みでは使えないため
  normalizeDefault: (items) => items.map((it) => ({ ...it, checked: false }))
}
