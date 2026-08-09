import { useEffect, useMemo, useState } from 'react'
import type { PriceRecord, PriceSort, PriceSortBy, Product, SortDir } from '../types'
import { useStore } from '../store'
import { unitModeDef } from '../lib/calc'
import { cheapestOf, effectiveUnitPrice, recordsOf, sortRecords } from '../lib/priceHistory'
import { formatDate } from '../lib/format'
import { copyText } from '../lib/clipboard'
import { loadPriceSort, savePriceSort } from '../lib/viewSettings'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { ProductModal } from './ProductModal'
import { PriceRecordModal } from './PriceRecordModal'

interface PriceSortOption {
  label: string
  short: string
  sortBy: PriceSortBy
  sortDir: SortDir
}

const PRICE_SORT_OPTIONS: PriceSortOption[] = [
  { label: '単価が安い順', short: '↑ 単価', sortBy: 'unitPrice', sortDir: 'asc' },
  { label: '単価が高い順', short: '↓ 単価', sortBy: 'unitPrice', sortDir: 'desc' },
  { label: '購入日(新しい順)', short: '↓ 購入日', sortBy: 'boughtAt', sortDir: 'desc' },
  { label: '購入日(古い順)', short: '↑ 購入日', sortBy: 'boughtAt', sortDir: 'asc' },
  { label: '記録した日(新しい順)', short: '↓ 記録日', sortBy: 'createdAt', sortDir: 'desc' },
  { label: '記録した日(古い順)', short: '↑ 記録日', sortBy: 'createdAt', sortDir: 'asc' }
]

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

      <div className="list-body list-body--fab">
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
  const [sort, setSort] = useState<PriceSort>(loadPriceSort)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  // 並び順の選択は永続化し、次に開いたときも同じ見え方にする
  useEffect(() => savePriceSort(sort), [sort])

  const records = useMemo(
    () => sortRecords(recordsOf(product.id, store.priceRecords), product, sort),
    [product, store.priceRecords, sort]
  )
  const best = cheapestOf(product, records)
  const mode = unitModeDef(product.unitMode)
  const currentSort =
    PRICE_SORT_OPTIONS.find((o) => o.sortBy === sort.sortBy && o.sortDir === sort.sortDir) ??
    PRICE_SORT_OPTIONS[0]

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="価格記録一覧へ戻る" onClick={onBack}>
          ‹
        </button>
        {/* 商品名はタップでコピーできる(検索欄や買い物メモへの貼り付け用) */}
        <h1 className="screen-title screen-title--copy">
          <button
            className="copy-title-btn"
            aria-label={`商品名「${product.name}」をコピー`}
            onClick={async () => {
              const ok = await copyText(product.name)
              toast(ok ? '商品名をコピーしました' : 'コピーできませんでした')
            }}
          >
            <span className="copy-title-text">{product.name}</span>
            <span className="copy-title-icon" aria-hidden="true">
              📋
            </span>
          </button>
        </h1>
        <button className="header-action" onClick={() => setEditingProduct(true)}>
          編集
        </button>
      </header>

      {records.length > 0 && (
        <div className="memo-controls">
          <button className="sort-btn" onClick={() => setSortMenuOpen(true)}>
            {currentSort.short} ▾
          </button>
        </div>
      )}

      <div className="list-body list-body--fab">
        {records.length === 0 ? (
          <div className="memo-empty">価格記録はまだありません。{'\n'}「＋ 価格を記録」から始めましょう</div>
        ) : (
          <div className="plain-card">
            {records.map((r) => {
              const up = effectiveUnitPrice(r, product.unitMode)
              const isBest = best?.record.id === r.id
              const qty = r.quantity ?? 1
              const taxLabel = r.taxMode === 'inclusive' ? '税込' : '税別'
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
                        ¥{r.price}({taxLabel}
                        {qty > 1 ? `・${qty}個` : ''}) → ¥{up != null ? up.toFixed(1) : '-'}/{mode.label} ・{' '}
                        {r.amount}
                        {mode.unit}
                        {r.discountRate ? ` ・還元${r.discountRate}%` : ''}
                      </div>
                    </div>
                    {/* 並び替えの基準になっている日付を右肩に出し、並び順と表示を一致させる */}
                    <span className="list-row-side">
                      {sort.sortBy === 'createdAt'
                        ? `記録 ${formatDate(r.createdAt)}`
                        : formatDate(r.boughtAt)}
                    </span>
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

      {sortMenuOpen && (
        <div className="menu-overlay" onClick={() => setSortMenuOpen(false)}>
          <div className="sort-menu" onClick={(e) => e.stopPropagation()}>
            {PRICE_SORT_OPTIONS.map((o) => {
              const on = o === currentSort
              return (
                <button
                  key={o.label}
                  onClick={() => {
                    setSort({ sortBy: o.sortBy, sortDir: o.sortDir })
                    setSortMenuOpen(false)
                  }}
                >
                  <span style={on ? { fontWeight: 900 } : undefined}>{o.label}</span>
                  <span className={`radio${on ? ' radio--on' : ''}`} />
                </button>
              )
            })}
          </div>
        </div>
      )}

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
