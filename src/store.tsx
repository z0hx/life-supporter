import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { ActivityLog, Category, Comparison, GoodNew, Memo, PriceRecord, Product, TaxMode } from './types'
import * as db from './lib/db'
import { uid } from './lib/format'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'shopping', label: '買い物', emoji: '🛒', builtin: true },
  { id: 'restaurant', label: '行きたい店', emoji: '🍜', builtin: true },
  { id: 'place', label: '場所', emoji: '🗺', builtin: true },
  { id: 'other', label: 'その他', builtin: true }
]

const DEFAULT_ARCHIVE_DAYS = 30
const EXPORT_REMIND_DAYS = 90

interface Store {
  ready: boolean
  memos: Memo[]
  comparisons: Comparison[]
  categories: Category[]
  goodNews: GoodNew[]
  activityLogs: ActivityLog[]
  products: Product[]
  priceRecords: PriceRecord[]
  archiveDays: number // 0 = 自動アーカイブしない
  lastExportAt: number | null
  addMemo: (input: MemoInput) => Promise<Memo>
  updateMemo: (id: string, patch: Partial<Memo>) => Promise<void>
  toggleDone: (id: string) => Promise<void>
  removeMemo: (id: string) => Promise<void>
  applySortOrders: (orders: { id: string; sortOrder: number }[]) => Promise<void>
  addCategory: (label: string) => Promise<Category>
  removeCategory: (id: string) => Promise<void>
  saveComparison: (c: Omit<Comparison, 'id' | 'savedAt'>) => Promise<Comparison>
  removeComparison: (id: string) => Promise<void>
  addGoodNew: (text: string) => Promise<GoodNew>
  updateGoodNew: (id: string, text: string) => Promise<void>
  removeGoodNew: (id: string) => Promise<void>
  addActivityLog: (text: string) => Promise<ActivityLog>
  updateActivityLog: (id: string, text: string) => Promise<void>
  removeActivityLog: (id: string) => Promise<void>
  addProduct: (input: ProductInput) => Promise<Product>
  updateProduct: (id: string, patch: Partial<ProductInput>) => Promise<void>
  removeProduct: (id: string) => Promise<void>
  addPriceRecord: (productId: string, input: PriceRecordInput) => Promise<PriceRecord>
  updatePriceRecord: (id: string, patch: Partial<PriceRecordInput>) => Promise<void>
  removePriceRecord: (id: string) => Promise<void>
  setArchiveDays: (days: number) => Promise<void>
  markExported: () => Promise<void>
  importReplace: (
    memos: Memo[],
    comparisons: Comparison[],
    categories: Category[],
    goodNews: GoodNew[],
    activityLogs: ActivityLog[],
    products: Product[],
    priceRecords: PriceRecord[]
  ) => Promise<void>
  importMerge: (
    memos: Memo[],
    comparisons: Comparison[],
    categories: Category[],
    goodNews: GoodNew[],
    activityLogs: ActivityLog[],
    products: Product[],
    priceRecords: PriceRecord[]
  ) => Promise<void>
  eraseAll: () => Promise<void>
}

export interface ProductInput {
  name: string
  unitMode: Product['unitMode']
  memo?: string
}

export interface PriceRecordInput {
  store: string
  price: number
  amount: number
  quantity: number
  taxMode: TaxMode
  discountRate?: number
  boughtAt: number
  memo?: string
}

export interface MemoInput {
  title: string
  category: string
  tags: string[]
  priority: 'normal' | 'high'
  note?: string
  source?: string
}

const StoreContext = createContext<Store | null>(null)

// setState に渡す更新関数はその場で実行される保証がないため、更新関数の中で外側の
// 変数に代入して永続化しようとすると書き込みが飛ぶことがある。永続化する値は
// 最新の state を保持する ref から組み立てる。
function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [memos, setMemos] = useState<Memo[]>([])
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [goodNews, setGoodNews] = useState<GoodNew[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([])
  const [archiveDays, setArchiveDaysState] = useState(DEFAULT_ARCHIVE_DAYS)
  const [lastExportAt, setLastExportAt] = useState<number | null>(null)

  const memosRef = useLatest(memos)
  const goodNewsRef = useLatest(goodNews)
  const activityLogsRef = useLatest(activityLogs)
  const productsRef = useLatest(products)
  const priceRecordsRef = useLatest(priceRecords)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // iOS Safari の自動削除対策(仕様書6章)
      try {
        await navigator.storage?.persist?.()
      } catch {
        // 非対応環境では無視
      }
      let cats = await db.getAllCategories()
      if (cats.length === 0) {
        await db.putCategories(DEFAULT_CATEGORIES)
        cats = DEFAULT_CATEGORIES
      }
      const days = (await db.getMeta<number>('archiveDays')) ?? DEFAULT_ARCHIVE_DAYS
      const exported = (await db.getMeta<number>('lastExportAt')) ?? null
      let all = await db.getAllMemos()

      // 完了済みメモの自動アーカイブ(既定30日・設定可)
      if (days > 0) {
        const cutoff = Date.now() - days * 86_400_000
        const toArchive = all.filter((m) => m.done && !m.archived && (m.doneAt ?? m.updatedAt) < cutoff)
        if (toArchive.length > 0) {
          const archived = toArchive.map((m) => ({ ...m, archived: true }))
          await db.putMemos(archived)
          const ids = new Set(archived.map((m) => m.id))
          all = all.map((m) => (ids.has(m.id) ? { ...m, archived: true } : m))
        }
      }
      const comps = await db.getAllComparisons()
      const gn = await db.getAllGoodNews()
      const al = await db.getAllActivityLogs()
      const prods = await db.getAllProducts()
      const recs = await db.getAllPriceRecords()
      if (cancelled) return
      setCategories(sortCategories(cats))
      setArchiveDaysState(days)
      setLastExportAt(exported)
      setMemos(all)
      setComparisons(comps.sort((a, b) => b.savedAt - a.savedAt))
      setGoodNews(gn.sort((a, b) => b.createdAt - a.createdAt))
      setActivityLogs(al.sort((a, b) => b.createdAt - a.createdAt))
      setProducts(prods.sort((a, b) => b.createdAt - a.createdAt))
      setPriceRecords(recs)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const addMemo = useCallback(async (input: MemoInput) => {
    const now = Date.now()
    const memo: Memo = {
      id: uid(),
      title: input.title,
      category: input.category,
      tags: input.tags,
      priority: input.priority,
      note: input.note || undefined,
      source: input.source || undefined,
      done: false,
      createdAt: now,
      updatedAt: now,
      sortOrder: now
    }
    await db.putMemo(memo)
    setMemos((prev) => [...prev, memo])
    return memo
  }, [])

  const updateMemo = useCallback(async (id: string, patch: Partial<Memo>) => {
    const current = memosRef.current.find((m) => m.id === id)
    if (!current) return
    const next: Memo = { ...current, ...patch, updatedAt: Date.now() }
    setMemos((prev) => prev.map((m) => (m.id === id ? next : m)))
    await db.putMemo(next)
  }, [])

  const toggleDone = useCallback(async (id: string) => {
    const current = memosRef.current.find((m) => m.id === id)
    if (!current) return
    const done = !current.done
    const next: Memo = { ...current, done, doneAt: done ? Date.now() : undefined, updatedAt: Date.now() }
    setMemos((prev) => prev.map((m) => (m.id === id ? next : m)))
    await db.putMemo(next)
  }, [])

  const removeMemo = useCallback(async (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
    await db.deleteMemo(id)
  }, [])

  const applySortOrders = useCallback(async (orders: { id: string; sortOrder: number }[]) => {
    const map = new Map(orders.map((o) => [o.id, o.sortOrder]))
    const changed = memosRef.current
      .filter((m) => {
        const so = map.get(m.id)
        return so !== undefined && so !== m.sortOrder
      })
      .map((m) => ({ ...m, sortOrder: map.get(m.id)! }))
    if (changed.length === 0) return
    const byId = new Map(changed.map((m) => [m.id, m]))
    setMemos((prev) => prev.map((m) => byId.get(m.id) ?? m))
    await db.putMemos(changed)
  }, [])

  const addCategory = useCallback(async (label: string) => {
    const cat: Category = { id: `custom-${uid()}`, label, builtin: false }
    await db.putCategory(cat)
    setCategories((prev) => sortCategories([...prev, cat]))
    return cat
  }, [])

  const removeCategory = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    await db.deleteCategory(id)
  }, [])

  const saveComparison = useCallback(async (c: Omit<Comparison, 'id' | 'savedAt'>) => {
    const comp: Comparison = { ...c, id: uid(), savedAt: Date.now() }
    await db.putComparison(comp)
    setComparisons((prev) => [comp, ...prev])
    return comp
  }, [])

  const removeComparison = useCallback(async (id: string) => {
    setComparisons((prev) => prev.filter((c) => c.id !== id))
    await db.deleteComparison(id)
  }, [])

  const addGoodNew = useCallback(async (text: string) => {
    const now = Date.now()
    const entry: GoodNew = { id: uid(), text, createdAt: now, updatedAt: now }
    await db.putGoodNew(entry)
    setGoodNews((prev) => [entry, ...prev])
    return entry
  }, [])

  const updateGoodNew = useCallback(async (id: string, text: string) => {
    const current = goodNewsRef.current.find((g) => g.id === id)
    if (!current) return
    const next: GoodNew = { ...current, text, updatedAt: Date.now() }
    setGoodNews((prev) => prev.map((g) => (g.id === id ? next : g)))
    await db.putGoodNew(next)
  }, [])

  const removeGoodNew = useCallback(async (id: string) => {
    setGoodNews((prev) => prev.filter((g) => g.id !== id))
    await db.deleteGoodNew(id)
  }, [])

  const addActivityLog = useCallback(async (text: string) => {
    const now = Date.now()
    const entry: ActivityLog = { id: uid(), text, createdAt: now, updatedAt: now }
    await db.putActivityLog(entry)
    setActivityLogs((prev) => [entry, ...prev])
    return entry
  }, [])

  const updateActivityLog = useCallback(async (id: string, text: string) => {
    const current = activityLogsRef.current.find((a) => a.id === id)
    if (!current) return
    const next: ActivityLog = { ...current, text, updatedAt: Date.now() }
    setActivityLogs((prev) => prev.map((a) => (a.id === id ? next : a)))
    await db.putActivityLog(next)
  }, [])

  const removeActivityLog = useCallback(async (id: string) => {
    setActivityLogs((prev) => prev.filter((a) => a.id !== id))
    await db.deleteActivityLog(id)
  }, [])

  const addProduct = useCallback(async (input: ProductInput) => {
    const now = Date.now()
    const product: Product = {
      id: uid(),
      name: input.name,
      unitMode: input.unitMode,
      memo: input.memo || undefined,
      createdAt: now,
      updatedAt: now
    }
    await db.putProduct(product)
    setProducts((prev) => [product, ...prev])
    return product
  }, [])

  const updateProduct = useCallback(async (id: string, patch: Partial<ProductInput>) => {
    const current = productsRef.current.find((p) => p.id === id)
    if (!current) return
    const next: Product = { ...current, ...patch, updatedAt: Date.now() }
    setProducts((prev) => prev.map((p) => (p.id === id ? next : p)))
    await db.putProduct(next)
  }, [])

  const removeProduct = useCallback(async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setPriceRecords((prev) => prev.filter((r) => r.productId !== id))
    await db.deleteProduct(id)
    await db.deletePriceRecordsByProduct(id)
  }, [])

  const addPriceRecord = useCallback(async (productId: string, input: PriceRecordInput) => {
    const now = Date.now()
    const record: PriceRecord = {
      id: uid(),
      productId,
      store: input.store,
      price: input.price,
      amount: input.amount,
      quantity: input.quantity,
      taxMode: input.taxMode,
      discountRate: input.discountRate,
      boughtAt: input.boughtAt,
      memo: input.memo || undefined,
      createdAt: now,
      updatedAt: now
    }
    await db.putPriceRecord(record)
    setPriceRecords((prev) => [...prev, record])
    return record
  }, [])

  const updatePriceRecord = useCallback(async (id: string, patch: Partial<PriceRecordInput>) => {
    const current = priceRecordsRef.current.find((r) => r.id === id)
    if (!current) return
    const next: PriceRecord = { ...current, ...patch, updatedAt: Date.now() }
    setPriceRecords((prev) => prev.map((r) => (r.id === id ? next : r)))
    await db.putPriceRecord(next)
  }, [])

  const removePriceRecord = useCallback(async (id: string) => {
    setPriceRecords((prev) => prev.filter((r) => r.id !== id))
    await db.deletePriceRecord(id)
  }, [])

  const setArchiveDays = useCallback(async (days: number) => {
    setArchiveDaysState(days)
    await db.setMeta('archiveDays', days)
  }, [])

  const markExported = useCallback(async () => {
    const now = Date.now()
    setLastExportAt(now)
    await db.setMeta('lastExportAt', now)
  }, [])

  const importReplace = useCallback(
    async (
      m: Memo[],
      c: Comparison[],
      cats: Category[],
      gn: GoodNew[],
      al: ActivityLog[],
      prods: Product[],
      recs: PriceRecord[]
    ) => {
      const nextCats = cats.length > 0 ? cats : DEFAULT_CATEGORIES
      await db.replaceAllData(m, c, nextCats, gn, al, prods, recs)
      setMemos(m)
      setComparisons([...c].sort((a, b) => b.savedAt - a.savedAt))
      setCategories(sortCategories(nextCats))
      setGoodNews([...gn].sort((a, b) => b.createdAt - a.createdAt))
      setActivityLogs([...al].sort((a, b) => b.createdAt - a.createdAt))
      setProducts([...prods].sort((a, b) => b.createdAt - a.createdAt))
      setPriceRecords(recs)
    },
    []
  )

  const importMerge = useCallback(
    async (
      m: Memo[],
      c: Comparison[],
      cats: Category[],
      gn: GoodNew[],
      al: ActivityLog[],
      prods: Product[],
      recs: PriceRecord[]
    ) => {
      await Promise.all([
        db.putMemos(m),
        db.putComparisons(c),
        db.putCategories(cats),
        db.putGoodNews(gn),
        db.putActivityLogs(al),
        db.putProducts(prods),
        db.putPriceRecords(recs)
      ])
      const mergeById = <T extends { id: string }>(prev: T[], add: T[]) => {
        const map = new Map(prev.map((x) => [x.id, x]))
        for (const x of add) map.set(x.id, x)
        return [...map.values()]
      }
      setMemos((prev) => mergeById(prev, m))
      setComparisons((prev) => mergeById(prev, c).sort((a, b) => b.savedAt - a.savedAt))
      setCategories((prev) => sortCategories(mergeById(prev, cats)))
      setGoodNews((prev) => mergeById(prev, gn).sort((a, b) => b.createdAt - a.createdAt))
      setActivityLogs((prev) => mergeById(prev, al).sort((a, b) => b.createdAt - a.createdAt))
      setProducts((prev) => mergeById(prev, prods).sort((a, b) => b.createdAt - a.createdAt))
      setPriceRecords((prev) => mergeById(prev, recs))
    },
    []
  )

  const eraseAll = useCallback(async () => {
    await db.clearAllData()
    await db.putCategories(DEFAULT_CATEGORIES)
    setMemos([])
    setComparisons([])
    setCategories(DEFAULT_CATEGORIES)
    setGoodNews([])
    setActivityLogs([])
    setProducts([])
    setPriceRecords([])
    setArchiveDaysState(DEFAULT_ARCHIVE_DAYS)
    setLastExportAt(null)
  }, [])

  const store = useMemo<Store>(
    () => ({
      ready,
      memos,
      comparisons,
      categories,
      goodNews,
      activityLogs,
      products,
      priceRecords,
      archiveDays,
      lastExportAt,
      addMemo,
      updateMemo,
      toggleDone,
      removeMemo,
      applySortOrders,
      addCategory,
      removeCategory,
      saveComparison,
      removeComparison,
      addGoodNew,
      updateGoodNew,
      removeGoodNew,
      addActivityLog,
      updateActivityLog,
      removeActivityLog,
      addProduct,
      updateProduct,
      removeProduct,
      addPriceRecord,
      updatePriceRecord,
      removePriceRecord,
      setArchiveDays,
      markExported,
      importReplace,
      importMerge,
      eraseAll
    }),
    [
      ready, memos, comparisons, categories, goodNews, activityLogs, products, priceRecords, archiveDays, lastExportAt,
      addMemo, updateMemo, toggleDone, removeMemo, applySortOrders,
      addCategory, removeCategory, saveComparison, removeComparison,
      addGoodNew, updateGoodNew, removeGoodNew,
      addActivityLog, updateActivityLog, removeActivityLog,
      addProduct, updateProduct, removeProduct, addPriceRecord, updatePriceRecord, removePriceRecord,
      setArchiveDays, markExported, importReplace, importMerge, eraseAll
    ]
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

// 既定カテゴリの定義順を保ちつつ、カスタムを後ろに並べる
function sortCategories(cats: Category[]): Category[] {
  const order = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.id, i]))
  return [...cats].sort((a, b) => {
    const ai = order.get(a.id) ?? 100
    const bi = order.get(b.id) ?? 100
    if (ai !== bi) return ai - bi
    return a.label.localeCompare(b.label, 'ja')
  })
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}

// 90日経過などの条件でバックアップのリマインドを表示(仕様書6章)
export function needsBackupReminder(
  store: Pick<
    Store,
    'lastExportAt' | 'memos' | 'comparisons' | 'goodNews' | 'activityLogs' | 'priceRecords'
  >
) {
  const hasData =
    store.memos.length > 0 ||
    store.comparisons.length > 0 ||
    store.goodNews.length > 0 ||
    store.activityLogs.length > 0 ||
    store.priceRecords.length > 0
  if (!hasData) return false
  if (store.lastExportAt == null) return true
  return Date.now() - store.lastExportAt > EXPORT_REMIND_DAYS * 86_400_000
}
