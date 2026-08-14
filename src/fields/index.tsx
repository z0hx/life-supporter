import type { ReactElement } from 'react'
import type { FieldKind, Memo, MemoField, TemplateField } from '../types'
import { uid } from '../lib/format'
import type { FieldDef } from './types'
import { longtextDef, phoneDef, textDef } from './text'
import { checklistDef } from './checklist'
import { urlDef } from './url'
import { locationDef } from './location'
import { selectDef } from './select'
import { comparisonDef } from './comparison'
import { dateDef, headingDef, numberDef, ratingDef, toggleDef } from './scalar'

export type { FieldDef } from './types'

export const FIELD_DEFS: { [K in FieldKind]: FieldDef<K> } = {
  text: textDef,
  longtext: longtextDef,
  checklist: checklistDef,
  url: urlDef,
  location: locationDef,
  number: numberDef,
  select: selectDef,
  date: dateDef,
  rating: ratingDef,
  toggle: toggleDef,
  phone: phoneDef,
  heading: headingDef,
  comparison: comparisonDef
}

// 項目追加シートに並べる順(Tier 1 が先)
export const FIELD_ORDER: FieldKind[] = [
  'checklist',
  'longtext',
  'text',
  'url',
  'location',
  'date',
  'number',
  'select',
  'rating',
  'toggle',
  'phone',
  'heading',
  'comparison'
]

// レジストリを種別非依存に扱うための型。ここが唯一のキャスト地点で、
// 外向きの API(下の関数群)はすべて型が付いている
interface LooseDef {
  kind: FieldKind
  name: string
  icon: string
  hint: string
  tier: 1 | 2
  createConfig: () => unknown
  createValue: (config: unknown) => unknown
  Input: (p: { field: MemoField; onChange: (v: unknown) => void }) => ReactElement | null
  ConfigInput?: (p: {
    field: TemplateField
    onChange: (c: unknown) => void
  }) => ReactElement | null
  summarize: (f: MemoField) => string
  searchText: (f: MemoField) => string
  isEmpty: (f: MemoField) => boolean
  normalizeDefault?: (value: unknown) => unknown
}

function defOf(kind: FieldKind): LooseDef {
  return FIELD_DEFS[kind] as unknown as LooseDef
}

export function fieldMeta(kind: FieldKind) {
  const d = defOf(kind)
  return { name: d.name, icon: d.icon, hint: d.hint, tier: d.tier }
}

// --- 描画 -------------------------------------------------------------------

/** メモ編集画面での入力UI。種別ごとの分岐はここで吸収する */
export function FieldInput({
  field,
  onChange
}: {
  field: MemoField
  onChange: (next: MemoField) => void
}) {
  const Input = defOf(field.kind).Input
  return <Input field={field} onChange={(value) => onChange({ ...field, value } as MemoField)} />
}

/** テンプレート編集画面での設定UI。設定を持たない種別では null を返す */
export function FieldConfigInput({
  field,
  onChange
}: {
  field: TemplateField
  onChange: (next: TemplateField) => void
}) {
  const ConfigInput = defOf(field.kind).ConfigInput
  if (!ConfigInput) return null
  return (
    <ConfigInput field={field} onChange={(config) => onChange({ ...field, config } as TemplateField)} />
  )
}

// --- 生成 -------------------------------------------------------------------

export function createTemplateField(kind: FieldKind, label?: string): TemplateField {
  const def = defOf(kind)
  return { id: uid(), kind, label: label ?? def.name, config: def.createConfig() } as TemplateField
}

/** テンプレートの項目定義を複製して、値を持つメモの項目にする */
export function instantiate(tf: TemplateField): MemoField {
  const def = defOf(tf.kind)
  return {
    id: uid(),
    kind: tf.kind,
    label: tf.label,
    config: tf.config,
    value: tf.defaultValue ?? def.createValue(tf.config)
  } as MemoField
}

/** メモの項目をテンプレートの項目定義に戻す(要件7) */
export function toTemplateField(mf: MemoField, keepValue: boolean): TemplateField {
  const tf: TemplateField = {
    id: uid(),
    kind: mf.kind,
    label: mf.label,
    config: mf.config
  } as TemplateField
  if (keepValue) {
    const def = defOf(mf.kind)
    ;(tf as { defaultValue?: unknown }).defaultValue = def.normalizeDefault
      ? def.normalizeDefault(mf.value)
      : mf.value
  }
  return tf
}

export function createMemoField(kind: FieldKind, label?: string): MemoField {
  return instantiate(createTemplateField(kind, label))
}

// --- 表示・検索 --------------------------------------------------------------

export function summarizeField(f: MemoField): string {
  return defOf(f.kind).summarize(f)
}

export function isFieldEmpty(f: MemoField): boolean {
  return defOf(f.kind).isEmpty(f)
}

/** 一覧行に出す要約。中身のある項目を先頭から2つまで */
export function memoSummary(memo: Memo): string[] {
  const out: string[] = []
  for (const f of memo.fields) {
    if (isFieldEmpty(f)) continue
    const s = summarizeField(f)
    if (s) out.push(s)
    if (out.length === 2) break
  }
  return out
}

export function memoSearchText(memo: Memo): string {
  const parts = [memo.title, memo.templateName]
  for (const f of memo.fields) {
    parts.push(f.label, defOf(f.kind).searchText(f))
  }
  return parts.join(' ').toLowerCase()
}
