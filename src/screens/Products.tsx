import { useEffect, useState } from 'react'
import type { PriceRecord, Product } from '../types'
import { useStore } from '../store'
import { unitModeDef, unitPrice } from '../lib/calc'
import { cheapestOf, recordsOf } from '../lib/priceHistory'
import { formatDate } from '../lib/format'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { ProductModal } from './ProductModal'
import { PriceRecordModal } from './PriceRecordModal'

export function Products({ route, navigate }: { route: string; navigate: (r: string) => void }) {
  const store = useStore()
  const [addingProduct, setAddingProduct] = useState(false)

  // 商品IDをハッシュに含めることで、ブラウザ/端末の戻る操作でも
  // 商品一覧 → ホームと1つずつ状態遷移するようにする
  const selectedId = route.startsWith('/products/') ? route.slice('/products/'.length) : null
  const selected = selectedId ? (store.products.find((p) => p.id === selectedId) ?? null) : null

  // 選択中の商品が削除された場合は一覧に戻る
  useEffect(() => {
    if (selectedId && !selected) navigate('/products')
  }, [selectedId, selected, navigate])

  if (selected) {
    return <ProductDetail product={selected} onBack={() => navigate('/products')} />
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="ホームへ戻る" onClick={() => navigate('/')}>
          ‹
        </button>
        <h1 className="screen-title">価格記録</h1>
      </header>

      <div className="list-body">
        {store.products.length === 0 ? (
          <div className="memo-empty">商品はまだありません。{'\n'}「＋ 商品を追加」から始めましょう</div>
        ) : (
          <div className="plain-card">
            {store.products.map((p) => {
              const records = recordsOf(p.id, store.priceRecords)
              const best = cheapestOf(p, records)
              const mode = unitModeDef(p.unitMode)
              return (
                <button key={p.id} className="list-row" onClick={() => navigate(`/products/${p.id}`)}>
                  <div className="list-row-main">
                    <div className="list-row-title">{p.name}</div>
                    <div className="list-row-sub">
                      {best
                        ? `🏆 ¥${best.unitPrice.toFixed(1)}/${mode.label} ・ ${best.record.store} ・ ${formatDate(best.record.boughtAt)}`
                        : '価格記録はまだありません'}
                    </div>
                  </div>
                  <span className="list-row-side">{records.length > 0 ? `${records.length}件` : ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => setAddingProduct(true)}>
        ＋ 商品を追加
      </button>

      {addingProduct && <ProductModal product={null} onClose={() => setAddingProduct(false)} />}
    </div>
  )
}

function ProductDetail({ product, onBack }: { product: Product; onBack: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [editingProduct, setEditingProduct] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PriceRecord | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PriceRecord | null>(null)

  const records = recordsOf(product.id, store.priceRecords).sort((a, b) => b.boughtAt - a.boughtAt)
  const best = cheapestOf(product, records)
  const mode = unitModeDef(product.unitMode)

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="価格記録一覧へ戻る" onClick={onBack}>
          ‹
        </button>
        <h1 className="screen-title">{product.name}</h1>
        <button className="header-action" onClick={() => setEditingProduct(true)}>
          編集
        </button>
      </header>

      <div className="list-body">
        {records.length === 0 ? (
          <div className="memo-empty">価格記録はまだありません。{'\n'}「＋ 価格を記録」から始めましょう</div>
        ) : (
          <div className="plain-card">
            {records.map((r) => {
              const up = unitPrice(r.price, r.amount, product.unitMode)
              const isBest = best?.record.id === r.id
              return (
                <div key={r.id} className="list-row" style={{ padding: 0 }}>
                  <button
                    className="list-row"
                    style={{ borderBottom: 'none', flex: 1 }}
                    onClick={() => setEditingRecord(r)}
                  >
                    <div className="list-row-main">
                      <div className="list-row-title">
                        {isBest && (
                          <span
                            className="tag-chip"
                            style={{ color: 'var(--accent)', background: 'var(--accent-soft)', marginRight: 6 }}
                          >
                            🏆最安
                          </span>
                        )}
                        {r.store}
                      </div>
                      <div className="list-row-sub">
                        ¥{r.price}(¥{up != null ? up.toFixed(1) : '-'}/{mode.label} ・ {r.amount}
                        {mode.unit})
                      </div>
                    </div>
                    <span className="list-row-side">{formatDate(r.boughtAt)}</span>
                  </button>
                  <button
                    className="row-delete-btn"
                    aria-label={`${r.store}の記録を削除`}
                    onClick={() => setDeleting(r)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => setEditingRecord('new')}>
        ＋ 価格を記録
      </button>

      {editingProduct && (
        <ProductModal product={product} onClose={() => setEditingProduct(false)} onDeleted={onBack} />
      )}
      {editingRecord && (
        <PriceRecordModal
          product={product}
          record={editingRecord === 'new' ? null : editingRecord}
          onClose={() => setEditingRecord(null)}
        />
      )}

      {deleting && (
        <Dialog
          title="価格記録を削除"
          message={`${deleting.store}の記録(¥${deleting.price})を削除します。よろしいですか?`}
          onClose={() => setDeleting(null)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.removePriceRecord(deleting.id)
                setDeleting(null)
                toast('価格記録を削除しました')
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setDeleting(null) }
          ]}
        />
      )}
    </div>
  )
}
