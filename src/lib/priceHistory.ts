import type { PriceRecord, Product } from '../types'
import { unitPrice } from './calc'

export interface PriceStat {
  record: PriceRecord
  unitPrice: number
}

export function recordsOf(productId: string, records: PriceRecord[]): PriceRecord[] {
  return records.filter((r) => r.productId === productId)
}

// 商品に属する記録のうち単価が最も安いもの(同額なら新しい記録を優先)
export function cheapestOf(product: Product, records: PriceRecord[]): PriceStat | null {
  let best: PriceStat | null = null
  for (const r of records) {
    const up = unitPrice(r.price, r.amount, product.unitMode)
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
