import type { UnitMode } from '../types'

export interface UnitModeDef {
  id: UnitMode
  chip: string // 単位モード切替チップの表示
  label: string // 「100gあたり」等
  base: number // 基準量
  unit: string // g / ml / 個 / 枚
}

export const UNIT_MODES: UnitModeDef[] = [
  { id: 'per100g', chip: '100gあたり', label: '100gあたり', base: 100, unit: 'g' },
  { id: 'per100ml', chip: '100ml', label: '100mlあたり', base: 100, unit: 'ml' },
  { id: 'perItem', chip: '1個', label: '1個あたり', base: 1, unit: '個' },
  { id: 'perSheet', chip: '1枚', label: '1枚あたり', base: 1, unit: '枚' }
]

export function unitModeDef(id: UnitMode) {
  return UNIT_MODES.find((m) => m.id === id) ?? UNIT_MODES[0]
}

// 全角数字・全角ピリオドにも耐える数値パース
export function parseNum(s: string): number {
  const normalized = s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .trim()
  const v = Number.parseFloat(normalized)
  return Number.isFinite(v) ? v : NaN
}

// 単価 = 価格 ÷ 内容量 × 基準量
export function unitPrice(price: number, amount: number, mode: UnitMode): number | null {
  if (!(price > 0) || !(amount > 0)) return null
  return (price / amount) * unitModeDef(mode).base
}

export interface CheapestResult {
  index: number
  unitPrice: number
  percent: number // 次点よりどれだけお得か(%)
  diff: number // 次点との差額(¥/単位)
}

// 有効入力が2件以上あり、最安が次点より真に安いときだけ判定を返す
export function findCheapest(prices: (number | null)[]): CheapestResult | null {
  const valid = prices
    .map((v, index) => ({ index, v }))
    .filter((x): x is { index: number; v: number } => x.v != null)
  if (valid.length < 2) return null
  const sorted = [...valid].sort((a, b) => a.v - b.v)
  const best = sorted[0]
  const second = sorted[1]
  if (!(best.v < second.v)) return null
  return {
    index: best.index,
    unitPrice: best.v,
    percent: Math.round((1 - best.v / second.v) * 100),
    diff: second.v - best.v
  }
}

export const ITEM_BADGES = ['🅰', '🅱', '🅲', '🅳', '🅴', '🅵', '🅶', '🅷']
export function itemBadge(i: number) {
  return ITEM_BADGES[i] ?? String(i + 1)
}
