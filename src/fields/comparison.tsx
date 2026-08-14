import type { Comparison } from '../types'
// store.tsx ではなくコンテキスト側から取る(循環参照を避けるため)
import { useStore } from '../storeContext'
import { findCheapest, unitModeDef, unitPrice } from '../lib/calc'
import { formatDate } from '../lib/format'
import type { FieldDef, FieldInputProps } from './types'

// 保存済み比較の1行要約(「牛乳A が 12% お得」)
export function describeComparison(c: Comparison): string {
  const mode = unitModeDef(c.unitMode)
  const prices = c.items.map((it) => unitPrice(it.price, it.amount, c.unitMode))
  const best = findCheapest(prices)
  if (best) {
    const label = c.items[best.index].label || `商品${best.index + 1}`
    return `${label} が ${best.percent}% お得`
  }
  return c.name || mode.label
}

function ComparisonInput({ field, onChange }: FieldInputProps<'comparison'>) {
  const { comparisons } = useStore()
  const selected = comparisons.find((c) => c.id === field.value) ?? null

  if (comparisons.length === 0) {
    return <div className="field-hint">単価計算の履歴がまだありません</div>
  }

  return (
    <div className="field-stack">
      <select
        className="field-input"
        value={field.value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">選択しない</option>
        {comparisons.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || describeComparison(c)}({formatDate(c.savedAt)})
          </option>
        ))}
      </select>
      {selected && <div className="field-hint">{describeComparison(selected)}</div>}
    </div>
  )
}

export const comparisonDef: FieldDef<'comparison'> = {
  kind: 'comparison',
  name: '単価比較',
  icon: '⚖️',
  hint: '保存した単価計算の結果をこのメモに紐付ける',
  tier: 2,
  createConfig: () => ({}),
  createValue: () => null,
  Input: ComparisonInput,
  // 比較の中身は store 側にあるので、要約は編集画面でのみ解決する
  summarize: (f) => (f.value ? '単価比較あり' : ''),
  searchText: () => '',
  isEmpty: (f) => !f.value
}
