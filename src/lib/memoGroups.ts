import type { Label, Memo, Template, ViewSettings } from '../types'

export interface LabelStyle {
  color: string
  bg: string
}

// アクセント3色を巡回して割り当てる(デザイントークン)
const PALETTE: LabelStyle[] = [
  { color: '#D97757', bg: '#FDEEE6' },
  { color: '#B0731D', bg: '#FEF3E2' },
  { color: '#4D8A5C', bg: '#EBF3EC' }
]
const GENERIC_STYLE: LabelStyle = { color: '#8A7D6E', bg: '#F3ECE2' }

export function labelStyle(key: string): LabelStyle {
  if (!key) return GENERIC_STYLE
  let h = 0
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return PALETTE[h % PALETTE.length]
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

export function buildGroups(
  memos: Memo[],
  labels: Label[],
  templates: Template[],
  vs: ViewSettings
): MemoGroup[] {
  const visible = memos.filter((m) => !m.archived && (vs.showDone || !m.done))
  const sort = (list: Memo[]) => [...list].sort((a, b) => compareMemos(a, b, vs))

  if (vs.groupBy === 'none') {
    if (visible.length === 0) return []
    return [{ key: 'all', label: 'すべて', color: GENERIC_STYLE.color, memos: sort(visible) }]
  }

  if (vs.groupBy === 'template') {
    const byTemplate = new Map<string, Memo[]>()
    for (const m of visible) {
      // テンプレートが削除済みでも templateName で束ねられる
      const key = m.templateId ?? `name:${m.templateName}`
      if (!byTemplate.has(key)) byTemplate.set(key, [])
      byTemplate.get(key)!.push(m)
    }
    return [...byTemplate.entries()]
      .map(([key, list]) => {
        const t = templates.find((x) => x.id === key)
        return {
          key: `tpl:${key}`,
          label: t?.name ?? list[0].templateName ?? 'テンプレートなし',
          emoji: t?.emoji,
          color: labelStyle(key).color,
          faded: !t,
          memos: sort(list)
        }
      })
      .sort((a, b) => b.memos.length - a.memos.length || a.label.localeCompare(b.label, 'ja'))
  }

  // ラベルごと。複数ラベルのメモは各グループに重複表示する
  const known = new Map(labels.map((l) => [l.id, l]))
  const byLabel = new Map<string, Memo[]>()
  const unlabeled: Memo[] = []
  for (const m of visible) {
    const valid = m.labels.filter((id) => known.has(id))
    if (valid.length === 0) {
      unlabeled.push(m)
      continue
    }
    for (const id of valid) {
      if (!byLabel.has(id)) byLabel.set(id, [])
      byLabel.get(id)!.push(m)
    }
  }
  // ラベルの並び順(設定画面で変えられる)をそのままグループ順にする
  const groups: MemoGroup[] = labels
    .filter((l) => byLabel.has(l.id))
    .map((l) => ({
      key: `label:${l.id}`,
      label: l.name,
      emoji: l.emoji,
      color: l.color ?? labelStyle(l.id).color,
      memos: sort(byLabel.get(l.id)!)
    }))
  if (unlabeled.length > 0) {
    groups.push({
      key: 'label:__none__',
      label: 'ラベルなし',
      color: GENERIC_STYLE.color,
      faded: true,
      memos: sort(unlabeled)
    })
  }
  return groups
}
