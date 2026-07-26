import { useMemo, useState } from 'react'
import type { PriceRecord, Product, TaxMode } from '../types'
import { useStore } from '../store'
import { parseNum, unitModeDef } from '../lib/calc'
import { effectiveUnitPrice } from '../lib/priceHistory'
import { formatDateTime, fromDateInputValue, toDateInputValue } from '../lib/format'
import { Dialog } from '../components/Dialog'
import { Segmented } from '../components/Segmented'
import { useToast } from '../components/Toast'

const QUANTITY_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

export function PriceRecordModal({
  product,
  record,
  onClose
}: {
  product: Product
  record: PriceRecord | null
  onClose: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const mode = unitModeDef(product.unitMode)
  const [storeName, setStoreName] = useState(record?.store ?? '')
  const [price, setPrice] = useState(record ? String(record.price) : '')
  const [amount, setAmount] = useState(record ? String(record.amount) : '')
  const [quantity, setQuantity] = useState(record?.quantity ?? 1)
  const [taxMode, setTaxMode] = useState<TaxMode>(record?.taxMode ?? 'exclusive')
  const [discountRate, setDiscountRate] = useState(record?.discountRate != null ? String(record.discountRate) : '')
  const [boughtAt, setBoughtAt] = useState(toDateInputValue(record?.boughtAt ?? Date.now()))
  const [memo, setMemo] = useState(record?.memo ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 店名の入力補助:これまでに記録した店名から候補を出す
  const storeSuggestions = useMemo(
    () => [...new Set(store.priceRecords.map((r) => r.store).filter(Boolean))],
    [store.priceRecords]
  )

  const p = parseNum(price)
  const a = parseNum(amount)
  const d = parseNum(discountRate)
  const discount = Number.isFinite(d) ? d : 0
  const preview = effectiveUnitPrice({ price: p, amount: a, quantity, taxMode, discountRate: discount }, product.unitMode)
  const canSave = storeName.trim() !== '' && p > 0 && a > 0

  const save = async () => {
    if (!canSave) return
    const input = {
      store: storeName.trim(),
      price: p,
      amount: a,
      quantity,
      taxMode,
      discountRate: discount > 0 ? discount : undefined,
      boughtAt: fromDateInputValue(boughtAt),
      memo: memo.trim() || undefined
    }
    if (record) {
      await store.updatePriceRecord(record.id, input)
      toast('価格記録を更新しました')
    } else {
      await store.addPriceRecord(product.id, input)
      toast('価格を記録しました')
    }
    onClose()
  }

  return (
    <>
      <div className="modal-overlay" />
      <div className="modal" role="dialog" aria-label={record ? '価格記録を編集' : '価格を記録'}>
        <header className="modal-header">
          <button className="modal-cancel" onClick={onClose}>
            キャンセル
          </button>
          <span className="modal-title">{record ? '価格記録を編集' : '価格を記録'}</span>
          <button className="modal-save" disabled={!canSave} onClick={save}>
            保存
          </button>
        </header>
        <div className="modal-body">
          <div>
            <div className="field-label">店名</div>
            <input
              className="title-input"
              list="price-record-stores"
              placeholder="例:イオン 〇〇店"
              value={storeName}
              autoFocus={!record}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <datalist id="price-record-stores">
              {storeSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
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
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="unit">{mode.unit}</span>
              </span>
            </label>
          </div>

          <div>
            <div className="field-label">税</div>
            <div style={{ width: 'fit-content' }}>
              <Segmented
                options={[
                  { value: 'exclusive', label: '税別' },
                  { value: 'inclusive', label: '税込み' }
                ]}
                value={taxMode}
                onChange={setTaxMode}
              />
            </div>
          </div>

          <div className="calc-inputs">
            <label className="calc-input-box">
              <span className="calc-input-label">個数(セット売りなど)</span>
              <span className="calc-input-row">
                <select
                  className="calc-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                >
                  {QUANTITY_OPTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <span className="unit">個</span>
              </span>
            </label>
            <label className="calc-input-box">
              <span className="calc-input-label">還元・割引率(任意)</span>
              <span className="calc-input-row">
                <input
                  className="calc-input"
                  inputMode="decimal"
                  placeholder="0"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                />
                <span className="unit">%</span>
              </span>
            </label>
          </div>

          {preview != null && (
            <div className="calc-result">
              実質単価 ¥{preview.toFixed(1)} / {mode.label}
            </div>
          )}

          <div>
            <div className="field-label">購入日</div>
            <input
              className="title-input"
              type="date"
              value={boughtAt}
              onChange={(e) => setBoughtAt(e.target.value)}
            />
          </div>

          <div>
            <div className="field-label">補足メモ(任意)</div>
            <textarea
              className="note-input"
              placeholder="セール・パッケージ違いなど…"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {record && (
            <div className="modal-dates">
              作成 {formatDateTime(record.createdAt)} · 更新 {formatDateTime(record.updatedAt)}
            </div>
          )}

          {record && (
            <button className="modal-delete" onClick={() => setConfirmDelete(true)}>
              この記録を削除
            </button>
          )}
        </div>
      </div>

      {confirmDelete && record && (
        <Dialog
          title="価格記録を削除"
          message={`${record.store}の記録(¥${record.price})を削除します。よろしいですか?`}
          onClose={() => setConfirmDelete(false)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.removePriceRecord(record.id)
                toast('価格記録を削除しました')
                onClose()
              }
            },
            { label: 'キャンセル', style: 'ghost', onClick: () => setConfirmDelete(false) }
          ]}
        />
      )}
    </>
  )
}
