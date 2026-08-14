import { useEffect, useRef, useState } from 'react'
import type { FieldDef, FieldConfigProps, FieldInputProps } from './types'

function SelectInput({ field, onChange }: FieldInputProps<'select'>) {
  const { options, multiple } = field.config
  const selected = field.value

  const toggle = (opt: string) => {
    if (multiple) {
      onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt])
    } else {
      onChange(selected[0] === opt ? [] : [opt])
    }
  }

  if (options.length === 0) {
    return <div className="field-hint">テンプレートで選択肢を設定してください</div>
  }

  return (
    <div className="chips">
      {options.map((o) => {
        const on = selected.includes(o)
        return (
          <button
            key={o}
            className={`chip${on ? ' chip--selected' : ''}`}
            aria-pressed={on}
            onClick={() => toggle(o)}
          >
            {o}
            {on ? ' ✓' : ''}
          </button>
        )
      })}
    </div>
  )
}

function SelectConfig({ field, onChange }: FieldConfigProps<'select'>) {
  const { options } = field.config
  const setOptions = (next: string[]) => onChange({ ...field.config, options: next })
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  // 追加した選択肢にそのまま入力できるよう、描画確定後にフォーカスする
  useEffect(() => {
    if (focusIndex == null) return
    inputs.current[focusIndex]?.focus()
    setFocusIndex(null)
  }, [focusIndex])

  return (
    <>
      <div className="field-config-row field-config-row--stack">
        <span>選択肢</span>
        <div className="option-list">
          {options.map((o, i) => (
            <div key={i} className="link-row">
              <input
                ref={(el) => {
                  inputs.current[i] = el
                }}
                className="field-input"
                value={o}
                placeholder={`選択肢 ${i + 1}`}
                onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                className="checklist-remove"
                aria-label="この選択肢を削除"
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="checklist-add"
            onClick={() => {
              setOptions([...options, ''])
              setFocusIndex(options.length)
            }}
          >
            ＋ 選択肢を追加
          </button>
        </div>
      </div>
      <label className="field-config-row field-config-row--check">
        <input
          type="checkbox"
          checked={field.config.multiple}
          onChange={(e) => onChange({ ...field.config, multiple: e.target.checked })}
        />
        <span>複数選べる</span>
      </label>
    </>
  )
}

export const selectDef: FieldDef<'select'> = {
  kind: 'select',
  name: '選択',
  icon: '🏷',
  hint: '決まった選択肢から選ぶ。状態やジャンルに',
  tier: 1,
  createConfig: () => ({ options: [], multiple: false }),
  createValue: () => [],
  Input: SelectInput,
  ConfigInput: SelectConfig,
  summarize: (f) => f.value.join('・'),
  searchText: (f) => f.value.join(' '),
  isEmpty: (f) => f.value.length === 0
}
