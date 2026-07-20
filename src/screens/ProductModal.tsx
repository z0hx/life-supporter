import { useState } from 'react'
import type { Product, UnitMode } from '../types'
import { useStore } from '../store'
import { UNIT_MODES } from '../lib/calc'
import { formatDateTime } from '../lib/format'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'

export function ProductModal({
  product,
  onClose,
  onDeleted
}: {
  product: Product | null
  onClose: () => void
  onDeleted?: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const [name, setName] = useState(product?.name ?? '')
  const [unitMode, setUnitMode] = useState<UnitMode>(product?.unitMode ?? 'per100g')
  const [memo, setMemo] = useState(product?.memo ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    const n = name.trim()
    if (!n) return
    const input = { name: n, unitMode, memo: memo.trim() || undefined }
    if (product) {
      await store.updateProduct(product.id, input)
      toast('商品を更新しました')
    } else {
      await store.addProduct(input)
      toast('商品を追加しました')
    }
    onClose()
  }

  return (
    <>
      <div className="modal-overlay" />
      <div className="modal" role="dialog" aria-label={product ? '商品を編集' : '商品を追加'}>
        <header className="modal-header">
          <button className="modal-cancel" onClick={onClose}>
            キャンセル
          </button>
          <span className="modal-title">{product ? '商品を編集' : '商品を追加'}</span>
          <button className="modal-save" disabled={!name.trim()} onClick={save}>
            保存
          </button>
        </header>
        <div className="modal-body">
          <input
            className="title-input"
            placeholder="商品名(例:卵 Mサイズ10個入り)"
            value={name}
            autoFocus={!product}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <div className="field-label">単位(価格の比べ方)</div>
            <div className="chips">
              {UNIT_MODES.map((m) => {
                const selected = m.id === unitMode
                return (
                  <button
                    key={m.id}
                    className={`chip${selected ? ' chip--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setUnitMode(m.id)}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="field-label">補足メモ(任意)</div>
            <textarea
              className="note-input"
              placeholder="銘柄やサイズの目安など…"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {product && (
            <div className="modal-dates">
              作成 {formatDateTime(product.createdAt)} · 更新 {formatDateTime(product.updatedAt)}
            </div>
          )}

          {product && (
            <button className="modal-delete" onClick={() => setConfirmDelete(true)}>
              この商品を削除
            </button>
          )}
        </div>
      </div>

      {confirmDelete && product && (
        <Dialog
          title="商品を削除"
          message={`「${product.name}」と、その価格記録をすべて削除します。よろしいですか?`}
          onClose={() => setConfirmDelete(false)}
          actions={[
            {
              label: '削除する',
              style: 'danger',
              onClick: async () => {
                await store.removeProduct(product.id)
                toast('商品を削除しました')
                onDeleted?.()
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
