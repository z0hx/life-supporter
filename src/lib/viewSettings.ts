import type { ViewSettings } from '../types'

// ViewSettings のみ localStorage(仕様書6章)
const VS_KEY = 'life-supporter:viewSettings'
const COLLAPSED_KEY = 'life-supporter:collapsedGroups'

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  groupBy: 'category',
  sortBy: 'updatedAt',
  sortDir: 'desc'
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
      return v as ViewSettings
    }
  } catch {
    // 壊れた値は既定に戻す
  }
  return DEFAULT_VIEW_SETTINGS
}

export function saveViewSettings(vs: ViewSettings) {
  localStorage.setItem(VS_KEY, JSON.stringify(vs))
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
