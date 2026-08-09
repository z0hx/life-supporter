import type { Category, Memo, ViewSettings } from '../types'

export interface CategoryStyle {
  color: string
  bg: string
}

// カテゴリ色(デザイントークン)
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  shopping: { color: '#D97757', bg: '#FDEEE6' },
  restaurant: { color: '#B0731D', bg: '#FEF3E2' },
  place: { color: '#4D8A5C', bg: '#EBF3EC' }
}
const GENERIC_STYLE: CategoryStyle = { color: '#8A7D6E', bg: '#F3ECE2' }

export function categoryStyle(id: string): CategoryStyle {
  return CATEGORY_STYLES[id] ?? GENERIC_STYLE
}

// タグ色はアクセント3色を巡回して割り当てる
const TAG_PALETTE: CategoryStyle[] = [
  { color: '#D97757', bg: '#FDEEE6' },
  { color: '#B0731D', bg: '#FEF3E2' },
  { color: '#4D8A5C', bg: '#EBF3EC' }
]

export function tagStyle(tag: string): CategoryStyle {
  let h = 0
  for (const ch of tag) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

// 完了は末尾、未完了内では優先度「高」が先頭固定、その中で選択ソート
export function compareMemos(a: Memo, b: Memo, vs: ViewSettings) {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (!a.done && a.priority !== b.priority) return a.priority === 'high' ? -1 : 1
  if (vs.sortBy === 'manual') return a.sortOrder - b.sortOrder
  const dir = vs.sortDir === 'desc' ? -1 : 1
  return (a[vs.sortBy] - b[vs.sortBy]) * dir
}

export interface MemoGroup {
  key: string
  label: string
  emoji?: string
  color: string
  faded?: boolean
  memos: Memo[]
}

export function buildGroups(memos: Memo[], categories: Category[], vs: ViewSettings): MemoGroup[] {
  const visible = memos.filter((m) => !m.archived && (vs.showDone || !m.done))
  const sort = (list: Memo[]) => [...list].sort((a, b) => compareMemos(a, b, vs))

  if (vs.groupBy === 'none') {
    if (visible.length === 0) return []
    return [{ key: 'all', label: 'すべて', color: '#8A7D6E', memos: sort(visible) }]
  }

  if (vs.groupBy === 'tag') {
    const byTag = new Map<string, Memo[]>()
    const untagged: Memo[] = []
    for (const m of visible) {
      if (m.tags.length === 0) {
        untagged.push(m)
      } else {
        // 複数タグのメモは各グループに重複表示
        for (const t of m.tags) {
          if (!byTag.has(t)) byTag.set(t, [])
          byTag.get(t)!.push(m)
        }
      }
    }
    const groups: MemoGroup[] = [...byTag.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ja'))
      .map(([tag, list]) => ({
        key: `tag:${tag}`,
        label: `#${tag}`,
        color: tagStyle(tag).color,
        memos: sort(list)
      }))
    if (untagged.length > 0) {
      groups.push({
        key: 'tag:__none__',
        label: 'タグなし',
        color: '#8A7D6E',
        faded: true,
        memos: sort(untagged)
      })
    }
    return groups
  }

  // カテゴリごと
  const known = new Set(categories.map((c) => c.id))
  const byCat = new Map<string, Memo[]>()
  for (const m of visible) {
    const key = known.has(m.category) ? m.category : 'other'
    if (!byCat.has(key)) byCat.set(key, [])
    byCat.get(key)!.push(m)
  }
  return categories
    .filter((c) => byCat.has(c.id))
    .map((c) => ({
      key: `cat:${c.id}`,
      label: c.label,
      emoji: c.emoji,
      color: categoryStyle(c.id).color,
      memos: sort(byCat.get(c.id)!)
    }))
}

export function collectTags(memos: Memo[]): string[] {
  const counts = new Map<string, number>()
  for (const m of memos) {
    if (m.archived) continue
    for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([t]) => t)
}
