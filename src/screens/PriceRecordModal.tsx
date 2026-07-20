import { useMemo, useState } from 'react'
import type { PriceRecord, Product } from '../types'
import { useStore } from '../store'
import { parseNum, unitModeDef, unitPrice } from '../lib/calc'
import { formatDateTime, fromDateInputValue, toDateInputValue } from '../lib/format'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'

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
  const preview = unitPrice(p, a, product.unitMode)
  const canSave = storeName.trim() !== '' && p > 0 && a > 0

  const save = async () => {
    if (!canSave) return
    const input = {
      store: storeName.trim(),
      price: p,
      amount: a,
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

          {preview != null && (
            <div className="calc-result">
              単価 ¥{preview.toFixed(1)} / {mode.label}
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
