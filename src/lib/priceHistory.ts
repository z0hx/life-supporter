import type { PriceRecord, Product, TaxMode, UnitMode } from '../types'
import { unitPrice } from './calc'

// 消費税の標準税率。税別記録を税込み換算してから比較するための既定値
export const TAX_RATE = 0.1

export interface EffectivePriceInput {
  price: number
  amount: number
  quantity?: number
  taxMode?: TaxMode
  discountRate?: number
}

// 税・個数(セット売り)・ポイント還元/割引率を加味した、比較用の実質単価
export function effectiveUnitPrice(input: EffectivePriceInput, unitMode: UnitMode): number | null {
  const taxed = input.taxMode === 'inclusive' ? input.price : input.price * (1 + TAX_RATE)
  const net = taxed * (1 - (input.discountRate ?? 0) / 100)
  const totalAmount = input.amount * (input.quantity ?? 1)
  return unitPrice(net, totalAmount, unitMode)
}

export interface PriceStat {
  record: PriceRecord
  unitPrice: number
}

export function recordsOf(productId: string, records: PriceRecord[]): PriceRecord[] {
  return records.filter((r) => r.productId === productId)
}

// 商品に属する記録のうち実質単価が最も安いもの(同額なら新しい記録を優先)
export function cheapestOf(product: Product, records: PriceRecord[]): PriceStat | null {
  let best: PriceStat | null = null
  for (const r of records) {
    const up = effectiveUnitPrice(r, product.unitMode)
    if (up == null) continue
    if (!best || up < best.unitPrice || (up === best.unitPrice && r.boughtAt > best.record.boughtAt)) {
      best = { record: r, unitPrice: up }
    }
  }
  return best
}

// 購入日が最も新しい記録
export function latestOf(records: PriceRecord[]): PriceRecord | null {
  return records.reduce<PriceRecord | null>(
    (latest, r) => (!latest || r.boughtAt > latest.boughtAt ? r : latest),
    null
  )
}
