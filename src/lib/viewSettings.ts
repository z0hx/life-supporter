import type { PriceSort, ViewSettings } from '../types'

// ViewSettings のみ localStorage(仕様書6章)
const VS_KEY = 'life-supporter:viewSettings'
const COLLAPSED_KEY = 'life-supporter:collapsedGroups'
const PRICE_SORT_KEY = 'life-supporter:priceSort'

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  groupBy: 'category',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  showDone: true
}

// 価格記録は「どこが一番安いか」を見るための画面なので、既定は単価の安い順
export const DEFAULT_PRICE_SORT: PriceSort = {
  sortBy: 'unitPrice',
  sortDir: 'asc'
}

export function loadViewSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(VS_KEY)
    if (!raw) return DEFAULT_VIEW_SETTINGS
    const v = JSON.parse(raw)
    if (
      ['category', 'tag', 'none'].includes(v.groupBy) &&
      ['createdAt', 'updatedAt', 'manual'].includes(v.sortBy) &&
      ['desc', 'asc'].includes(v.sortDir)
    ) {
      // showDone を持たない旧バージョンの保存値は、従来どおり表示する側に寄せる
      return { ...(v as ViewSettings), showDone: typeof v.showDone === 'boolean' ? v.showDone : true }
    }
  } catch {
    // 壊れた値は既定に戻す
  }
  return DEFAULT_VIEW_SETTINGS
}

export function saveViewSettings(vs: ViewSettings) {
  localStorage.setItem(VS_KEY, JSON.stringify(vs))
}

export function loadPriceSort(): PriceSort {
  try {
    const raw = localStorage.getItem(PRICE_SORT_KEY)
    if (!raw) return DEFAULT_PRICE_SORT
    const v = JSON.parse(raw)
    if (
      ['unitPrice', 'boughtAt', 'createdAt'].includes(v.sortBy) &&
      ['desc', 'asc'].includes(v.sortDir)
    ) {
      return v as PriceSort
    }
  } catch {
    // 壊れた値は既定に戻す
  }
  return DEFAULT_PRICE_SORT
}

export function savePriceSort(sort: PriceSort) {
  localStorage.setItem(PRICE_SORT_KEY, JSON.stringify(sort))
}

export function loadCollapsedGroups(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveCollapsedGroups(keys: string[]) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(keys))
}
