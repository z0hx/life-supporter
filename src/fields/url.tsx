import { useEffect, useRef, useState } from 'react'
import type { LinkValue } from '../types'
import { uid } from '../lib/format'
import type { FieldDef, FieldInputProps } from './types'

// 「example.com」のような入力でも開けるように補う
export function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
}

function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function UrlInput({ field, onChange }: FieldInputProps<'url'>) {
  const links = field.value
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const [focusId, setFocusId] = useState<string | null>(null)

  // 追加した行にそのまま入力できるよう、描画確定後にフォーカスする
  useEffect(() => {
    if (!focusId) return
    inputs.current.get(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  const patch = (id: string, p: Partial<LinkValue>) =>
    onChange(links.map((l) => (l.id === id ? { ...l, ...p } : l)))

  const add = () => {
    const link: LinkValue = { id: uid(), url: '' }
    onChange([...links, link])
    setFocusId(link.id)
  }

  return (
    <div className="link-list">
      {links.map((l) => (
        <div key={l.id} className="link-row">
          <input
            ref={(el) => {
              if (el) inputs.current.set(l.id, el)
              else inputs.current.delete(l.id)
            }}
            className="field-input"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            value={l.url}
            placeholder="https://…"
            onChange={(e) => patch(l.id, { url: e.target.value })}
          />
          {field.config.multiple && (
            <input
              className="field-input field-input--narrow"
              value={l.label ?? ''}
              placeholder="ラベル"
              onChange={(e) => patch(l.id, { label: e.target.value })}
            />
          )}
          {l.url.trim() && (
            <a
              className="field-action"
              href={normalizeUrl(l.url)}
              target="_blank"
              rel="noreferrer noopener"
            >
              開く
            </a>
          )}
          <button
            className="checklist-remove"
            aria-label="このリンクを削除"
            onClick={() => onChange(links.filter((x) => x.id !== l.id))}
          >
            ✕
          </button>
        </div>
      ))}
      {(field.config.multiple || links.length === 0) && (
        <button className="checklist-add" onClick={add}>
          ＋ リンクを追加
        </button>
      )}
    </div>
  )
}

export const urlDef: FieldDef<'url'> = {
  kind: 'url',
  name: 'リンク',
  icon: '🔗',
  hint: '参考にしたページ。タップで開く',
  tier: 1,
  createConfig: () => ({ multiple: true }),
  createValue: () => [],
  Input: UrlInput,
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row field-config-row--check">
      <input
        type="checkbox"
        checked={field.config.multiple}
        onChange={(e) => onChange({ ...field.config, multiple: e.target.checked })}
      />
      <span>複数のリンクを持てる</span>
    </label>
  ),
  summarize: (f) => {
    const first = f.value.find((l) => l.url.trim())
    if (!first) return ''
    const name = first.label?.trim() || hostOf(first.url)
    return f.value.length > 1 ? `${name} 他${f.value.length - 1}件` : name
  },
  searchText: (f) => f.value.map((l) => `${l.label ?? ''} ${l.url}`).join(' '),
  isEmpty: (f) => f.value.every((l) => !l.url.trim())
}
