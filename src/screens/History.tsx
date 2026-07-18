import { useState } from 'react'
import type { Comparison } from '../types'
import { useStore } from '../store'
import { findCheapest, unitModeDef, unitPrice } from '../lib/calc'
import { formatDate } from '../lib/format'
import { Dialog } from '../components/Dialog'
import type { CalcDraft } from './Calc'

export function History({
  navigate,
  restoreDraft
}: {
  navigate: (r: string) => void
  restoreDraft: (d: CalcDraft) => void
}) {
  const store = useStore()
  const [deleting, setDeleting] = useState<Comparison | null>(null)

  const restore = (c: Comparison) => {
    // タップで比較状態を復元して単価計算へ
    restoreDraft({
      unitMode: c.unitMode,
      items: c.items.map((it) => ({
        label: it.label ?? '',
        price: String(it.price),
        amount: String(it.amount)
      }))
    })
    navigate('/calc')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="単価計算へ戻る" onClick={() => navigate('/calc')}>
          ‹
        </button>
        <h1 className="screen-title">履歴</h1>
      </header>
      <div className="list-body">
        {store.comparisons.length === 0 ? (
          <div className="memo-empty">保存した比較はまだありません</div>
        ) : (
          <div className="plain-card">
            {store.comparisons.map((c) => {
              const mode = unitModeDef(c.unitMode)
              const best = findCheapest(c.items.map((it) => unitPrice(it.price, it.amount, c.unitMode)))
              const sub = best
                ? `${c.items[best.index].label || `商品${best.index + 1}`}が ${best.percent}% お得 · ${mode.label}`
                : `${c.items.length}商品 · ${mode.label}`
              return (
                <div key={c.id} className="list-row" style={{ padding: 0 }}>
                  <button
                    className="list-row"
                    style={{ borderBottom: 'none', flex: 1 }}
                    onClick={() => restore(c)}
                  >
                    <div className="list-row-main">
                      <div className="list-row-title">{c.name || '(名前なし)'}</div>
                      <div className="list-row-sub">{sub}</div>
                    </div>
                    <span className="list-row-side">{formatDate(c.savedAt)}</span>
                  </button>
                  <button
                    className="row-delete-btn"
                    aria-label={`${c.name || '履歴'}を削除`}
                    onClick={() => setDeleting(c)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleting && (
        <Dialog
          title="履歴を削除"
          message={`「${deleting.name || '(名前なし)'}」を削除します。よろしいですか?`}
          onClose={() => setDeleting(null)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.removeComparison(deleting.id)
                setDeleting(null)
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setDeleting(null) }
          ]}
        />
      )}
    </div>
  )
}
