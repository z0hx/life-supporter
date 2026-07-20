import { useState } from 'react'
import type { UnitMode } from '../types'
import { useStore } from '../store'
import { findCheapest, itemBadge, parseNum, UNIT_MODES, unitModeDef, unitPrice } from '../lib/calc'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'

export interface CalcDraftItem {
  label: string
  price: string
  amount: string
}

export interface CalcDraft {
  unitMode: UnitMode
  items: CalcDraftItem[]
}

export const EMPTY_DRAFT: CalcDraft = {
  unitMode: 'per100g',
  items: [
    { label: '', price: '', amount: '' },
    { label: '', price: '', amount: '' }
  ]
}

export function Calc({
  draft,
  setDraft,
  navigate
}: {
  draft: CalcDraft
  setDraft: (d: CalcDraft) => void
  navigate: (r: string) => void
}) {
  const store = useStore()
  const toast = useToast()
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const mode = unitModeDef(draft.unitMode)
  // 入力毎にリアルタイム再計算
  const prices = draft.items.map((it) => {
    const p = parseNum(it.price)
    const a = parseNum(it.amount)
    return unitPrice(p, a, draft.unitMode)
  })
  const best = findCheapest(prices)

  const updateItem = (i: number, patch: Partial<CalcDraftItem>) => {
    const items = draft.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    setDraft({ ...draft, items })
  }

  const validItems = draft.items
    .map((it) => ({ label: it.label.trim() || undefined, price: parseNum(it.price), amount: parseNum(it.amount) }))
    .filter((it) => it.price > 0 && it.amount > 0)

  const doSave = async () => {
    await store.saveComparison({
      name: saveName.trim() || undefined,
      unitMode: draft.unitMode,
      items: validItems
    })
    setSaveOpen(false)
    setSaveName('')
    toast('履歴に保存しました')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="ホームへ戻る" onClick={() => navigate('/')}>
          ‹
        </button>
        <h1 className="screen-title">単価計算</h1>
        <button className="header-action" onClick={() => navigate('/history')}>
          🕐 履歴
        </button>
      </header>

      <div className="calc-topbar">
        <div className="unit-chips" role="group" aria-label="単位モード">
          {UNIT_MODES.map((m) => (
            <button
              key={m.id}
              className="unit-chip"
              aria-pressed={m.id === draft.unitMode}
              onClick={() => setDraft({ ...draft, unitMode: m.id })}
            >
              {m.chip}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-scroll">
        {draft.items.map((it, i) => {
          const isBest = best?.index === i
          const up = prices[i]
          return (
            <div key={i} className={`calc-card${isBest ? ' calc-card--best' : ''}`}>
              {isBest && <span className="calc-badge">🎉 こっちがお得!</span>}
              <div className="calc-card-head">
                <span className="calc-badge-letter" aria-hidden="true">
                  {itemBadge(i)}
                </span>
                <input
                  className="calc-label-input"
                  placeholder={`商品${i + 1}(任意)`}
                  value={it.label}
                  onChange={(e) => updateItem(i, { label: e.target.value })}
                />
                {up != null && (
                  <span
                    className={`calc-head-price${isBest ? ' calc-head-price--best' : ''}`}
                    aria-label={`${mode.label} ${up.toFixed(1)}円`}
                  >
                    <span className="yen">¥</span>
                    {up.toFixed(1)}
                    <span className="per">/{mode.base === 1 ? '' : mode.base}{mode.unit}</span>
                  </span>
                )}
                {draft.items.length > 2 && (
                  <button
                    className="calc-remove"
                    aria-label={`商品${i + 1}を削除`}
                    onClick={() =>
                      setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) })
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="calc-inputs">
                <label className="calc-input-box">
                  <span className="calc-input-label">価格</span>
                  <span className="calc-input-row">
                    <span className="yen">¥</span>
                    <input
                      className="calc-input"
                      inputMode="decimal"
                      placeholder="0"
                      value={it.price}
                      onChange={(e) => updateItem(i, { price: e.target.value })}
                    />
                  </span>
                </label>
                <label className="calc-input-box">
                  <span className="calc-input-label">内容量</span>
                  <span className="calc-input-row">
                    <input
                      className="calc-input"
                      inputMode="decimal"
                      placeholder="0"
                      value={it.amount}
                      onChange={(e) => updateItem(i, { amount: e.target.value })}
                    />
                    <span className="unit">{mode.unit}</span>
                  </span>
                </label>
              </div>
              {isBest && best && (
                <div className="calc-result">
                  {best.percent}% お得・差 ¥{best.diff.toFixed(1)}/{mode.unit}
                </div>
              )}
            </div>
          )
        })}

        <button
          className="add-item-btn"
          onClick={() =>
            setDraft({ ...draft, items: [...draft.items, { label: '', price: '', amount: '' }] })
          }
        >
          ＋ 商品をくらべる
        </button>
      </div>

      <div className="calc-footer">
        <button className="btn-secondary" onClick={() => setDraft(EMPTY_DRAFT)}>
          クリア
        </button>
        <button
          className="btn-primary-dark"
          disabled={validItems.length < 2}
          onClick={() => setSaveOpen(true)}
        >
          履歴に保存
        </button>
      </div>

      {saveOpen && (
        <Dialog
          title="履歴に保存"
          message="あとで見返せるように名前を付けられます(例:トイレットペーパー)。"
          onClose={() => setSaveOpen(false)}
          actions={[
            { label: '保存する', style: 'primary', onClick: doSave },
            { label: 'キャンセル', style: 'ghost', onClick: () => setSaveOpen(false) }
          ]}
        >
          <input
            className="dialog-input"
            placeholder="名前(任意)"
            value={saveName}
            autoFocus
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doSave()
            }}
          />
        </Dialog>
      )}
    </div>
  )
}
