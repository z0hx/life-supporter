export type Priority = 'normal' | 'high'

// ---------------------------------------------------------------------------
// フィールド(メモを構成するコンポーネント)
// ---------------------------------------------------------------------------

export type FieldKind =
  | 'text'
  | 'longtext'
  | 'checklist'
  | 'url'
  | 'location'
  | 'number'
  | 'select'
  | 'date'
  | 'rating'
  | 'toggle'
  | 'phone'
  | 'heading'
  | 'comparison'

export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
}

export interface LinkValue {
  id: string
  url: string
  label?: string
}

export interface LocationValue {
  name?: string
  address?: string
  lat?: number
  lng?: number
  zoom?: number // 保存時の縮尺。開き直したとき同じ画角に戻す
}

// 種別ごとの「設定」— テンプレート側で決め、メモへ複製される
export interface FieldConfigMap {
  text: { placeholder?: string }
  longtext: { placeholder?: string; rows?: number }
  checklist: { allowAdd: boolean }
  url: { multiple: boolean }
  location: { tileUrl?: string; attribution?: string; defaultZoom?: number }
  number: { unit?: string; decimals?: number }
  select: { options: string[]; multiple: boolean }
  date: { withTime: boolean }
  rating: { max: number }
  toggle: {}
  phone: {}
  heading: {}
  comparison: {}
}

// 種別ごとの「値」— メモ側が持つ
export interface FieldValueMap {
  text: string
  longtext: string
  checklist: ChecklistItem[]
  url: LinkValue[]
  location: LocationValue
  number: number | null
  select: string[]
  date: string | null // 'YYYY-MM-DD' または 'YYYY-MM-DDTHH:mm'
  rating: number | null
  toggle: boolean
  phone: string
  heading: null
  comparison: string | null // Comparison.id
}

interface FieldBase<K extends FieldKind> {
  id: string
  kind: K
  label: string
  config: FieldConfigMap[K]
}

export type TemplateFieldOf<K extends FieldKind> = FieldBase<K> & {
  required?: boolean
  defaultValue?: FieldValueMap[K]
}

export type MemoFieldOf<K extends FieldKind> = FieldBase<K> & {
  value: FieldValueMap[K]
}

export type TemplateField = { [K in FieldKind]: TemplateFieldOf<K> }[FieldKind]
export type MemoField = { [K in FieldKind]: MemoFieldOf<K> }[FieldKind]

// ---------------------------------------------------------------------------
// テンプレート・メモ・ラベル
// ---------------------------------------------------------------------------

export interface Template {
  id: string
  name: string
  emoji?: string
  description?: string
  fields: TemplateField[]
  defaultLabels: string[] // Label.id[]
  builtin: boolean
  createdAt: number
  updatedAt: number
  sortOrder: number
}

export interface Memo {
  id: string
  templateId: string | null // 由来。参照であって束縛ではない
  templateName: string // テンプレ削除後も表示できるよう複製しておく
  title: string // 常設。一覧表示のためコンポーネント化しない
  labels: string[] // Label.id[] — グループ化のキー
  fields: MemoField[] // テンプレから複製したスキーマ + 値
  priority: Priority
  done: boolean
  doneAt?: number
  archived?: boolean
  createdAt: number
  updatedAt: number
  sortOrder: number
}

export interface Label {
  id: string
  name: string
  emoji?: string
  color?: string
  sortOrder: number
}

// ---------------------------------------------------------------------------
// 既存機能(単価計算・日次ログ)— 変更なし
// ---------------------------------------------------------------------------

// 日ごとに自由記述を書き留めるログの共通形。Good & New と行動記録が同じ形を持つ
export interface DailyLogEntry {
  id: string
  text: string
  createdAt: number
  updatedAt: number
}

export type GoodNew = DailyLogEntry
export type ActivityLog = DailyLogEntry

export type UnitMode = 'per100g' | 'per100ml' | 'perItem' | 'perSheet'

export interface ComparisonItem {
  label?: string
  price: number
  amount: number
}

export interface Comparison {
  id: string
  name?: string
  unitMode: UnitMode
  items: ComparisonItem[]
  savedAt: number
}

// 商品ごとの価格記録(いつ・どの店で・いくらだったか)
export interface Product {
  id: string
  name: string
  unitMode: UnitMode // その商品の記録に共通する単位(比較の基準を揃える)
  memo?: string
  createdAt: number
  updatedAt: number
}

export type TaxMode = 'exclusive' | 'inclusive'

export interface PriceRecord {
  id: string
  productId: string
  store: string
  price: number
  amount: number
  quantity?: number // 個数(セット売りを想定。未指定は1として扱う)
  taxMode?: TaxMode // 税別/税込み(未指定は税別として扱う)
  discountRate?: number // ポイント還元・割引率(%)。実質価格での比較に使う
  boughtAt: number // その価格だった日(過去日を指定して記録できる)
  memo?: string
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// 表示設定
// ---------------------------------------------------------------------------

export type GroupBy = 'label' | 'template' | 'none'
export type SortBy = 'createdAt' | 'updatedAt' | 'manual'
export type SortDir = 'desc' | 'asc'

export interface ViewSettings {
  groupBy: GroupBy
  sortBy: SortBy
  sortDir: SortDir
  showDone: boolean // 完了済みメモを一覧に出すか
}

// 商品ごとの価格記録一覧の並び順。boughtAt は購入日、createdAt は記録を入力した日
export type PriceSortBy = 'unitPrice' | 'boughtAt' | 'createdAt'

export interface PriceSort {
  sortBy: PriceSortBy
  sortDir: SortDir
}
