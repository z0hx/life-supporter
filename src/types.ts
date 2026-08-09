export type Priority = 'normal' | 'high'

export interface Memo {
  id: string
  title: string
  category: string // "shopping" | "restaurant" | "place" | "other" | custom id
  tags: string[]
  priority: Priority
  note?: string
  source?: string
  done: boolean
  doneAt?: number
  archived?: boolean
  createdAt: number
  updatedAt: number
  sortOrder: number
}

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

export interface Category {
  id: string
  label: string
  emoji?: string
  builtin: boolean
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

export type GroupBy = 'category' | 'tag' | 'none'
export type SortBy = 'createdAt' | 'updatedAt' | 'manual'
export type SortDir = 'desc' | 'asc'

export interface ViewSettings {
  groupBy: GroupBy
  sortBy: SortBy
  sortDir: SortDir
}

// 商品ごとの価格記録一覧の並び順。boughtAt は購入日、createdAt は記録を入力した日
export type PriceSortBy = 'unitPrice' | 'boughtAt' | 'createdAt'

export interface PriceSort {
  sortBy: PriceSortBy
  sortDir: SortDir
}
