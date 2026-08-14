import { createContext, useContext } from 'react'
// 型のみの import。実行時の依存にはならないので循環参照は生まれない
import type { Store } from './store'

// コンテキストを store.tsx から切り離しておく。
// store.tsx は fields/ を import し、fields/comparison.tsx は useStore を必要とするため、
// 同じモジュールに置くと循環参照になり、Provider より先に評価された側が null を掴む
export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}
