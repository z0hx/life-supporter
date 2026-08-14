import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  ActivityLog,
  Comparison,
  GoodNew,
  Label,
  Memo,
  MemoField,
  PriceRecord,
  Priority,
  Product,
  TaxMode,
  Template
} from './types'
import * as db from './lib/db'
import { uid } from './lib/format'
import { DEFAULT_LABELS, buildDefaultTemplates } from './lib/defaults'
import { instantiate, toTemplateField } from './fields'
import { StoreContext, useStore } from './storeContext'

export { useStore }

const DEFAULT_ARCHIVE_DAYS = 30
const EXPORT_REMIND_DAYS = 90

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

export interface MemoDraft {
  templateId: string | null
  templateName: string
  title: string
  labels: string[]
  fields: MemoField[]
  priority: Priority
}

export interface Store {
  ready: boolean
  memos: Memo[]
  templates: Template[]
  labels: Label[]
  comparisons: Comparison[]
  goodNews: GoodNew[]
  activityLogs: ActivityLog[]
  products: Product[]
  priceRecords: PriceRecord[]
  archiveDays: number // 0 = 自動アーカイブしない
  lastExportAt: number | null

  addMemo: (draft: MemoDraft) => Promise<Memo>
  /** テンプレートから空のメモ下書きを作る(まだ保存はしない) */
  draftFromTemplate: (template: Template) => MemoDraft
  updateMemo: (id: string, patch: Partial<Memo>) => Promise<void>
  toggleDone: (id: string) => Promise<void>
  removeMemo: (id: string) => Promise<void>
  applySortOrders: (orders: { id: string; sortOrder: number }[]) => Promise<void>

  addTemplate: (input: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'builtin'>) => Promise<Template>
  updateTemplate: (id: string, patch: Partial<Template>) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  duplicateTemplate: (id: string) => Promise<Template | null>
  /** メモの構成をテンプレートとして保存する(要件7) */
  templateFromMemo: (
    source: { fields: MemoField[]; labels: string[] },
    name: string,
    keepValues: boolean
  ) => Promise<Template>

  addLabel: (name: string) => Promise<Label>
  updateLabel: (id: string, patch: Partial<Label>) => Promise<void>
  removeLabel: (id: string) => Promise<void>

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
  importReplace: (data: db.DataSet) => Promise<void>
  importMerge: (data: db.DataSet) => Promise<void>
  eraseAll: () => Promise<void>
}

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
  const [templates, setTemplates] = useState<Template[]>([])
  const [labels, setLabels] = useState<Label[]>(DEFAULT_LABELS)
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [goodNews, setGoodNews] = useState<GoodNew[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([])
  const [archiveDays, setArchiveDaysState] = useState(DEFAULT_ARCHIVE_DAYS)
  const [lastExportAt, setLastExportAt] = useState<number | null>(null)

  const memosRef = useLatest(memos)
  const templatesRef = useLatest(templates)
  const labelsRef = useLatest(labels)
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

      let labs = await db.labels.getAll()
      if (labs.length === 0) {
        await db.labels.putMany(DEFAULT_LABELS)
        labs = DEFAULT_LABELS
      }
      let tpls = await db.templates.getAll()
      if (tpls.length === 0) {
        tpls = buildDefaultTemplates()
        await db.templates.putMany(tpls)
      }

      const days = (await db.getMeta<number>('archiveDays')) ?? DEFAULT_ARCHIVE_DAYS
      const exported = (await db.getMeta<number>('lastExportAt')) ?? null
      let all = await db.memos.getAll()

      // 完了済みメモの自動アーカイブ(既定30日・設定可)
      if (days > 0) {
        const cutoff = Date.now() - days * 86_400_000
        const toArchive = all.filter(
          (m) => m.done && !m.archived && (m.doneAt ?? m.updatedAt) < cutoff
        )
        if (toArchive.length > 0) {
          const archived = toArchive.map((m) => ({ ...m, archived: true }))
          await db.memos.putMany(archived)
          const ids = new Set(archived.map((m) => m.id))
          all = all.map((m) => (ids.has(m.id) ? { ...m, archived: true } : m))
        }
      }

      const comps = await db.comparisons.getAll()
      const gn = await db.goodNews.getAll()
      const al = await db.activityLogs.getAll()
      const prods = await db.products.getAll()
      const recs = await db.priceRecords.getAll()
      if (cancelled) return
      setLabels(sortLabels(labs))
      setTemplates(sortTemplates(tpls))
      setArchiveDaysState(days)
      setLastExportAt(exported)
      setMemos(all)
      setComparisons(comps.sort((a, b) => b.savedAt - a.savedAt))
      setGoodNews(gn.sort((a, b) => b.createdAt - a.createdAt))
      setActivityLogs(al.sort((a, b) => b.createdAt - a.createdAt))
      setProducts(prods.sort((a, b) => b.updatedAt - a.updatedAt))
      setPriceRecords(recs)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // --- メモ -----------------------------------------------------------------

  const draftFromTemplate = useCallback(
    (t: Template): MemoDraft => ({
      templateId: t.id,
      templateName: t.name,
      title: '',
      labels: [...t.defaultLabels],
      // テンプレートの定義を複製する。以降このメモはテンプレートから独立する
      fields: t.fields.map(instantiate),
      priority: 'normal'
    }),
    []
  )

  const addMemo = useCallback(async (draft: MemoDraft) => {
    const now = Date.now()
    const memo: Memo = {
      ...draft,
      id: uid(),
      done: false,
      createdAt: now,
      updatedAt: now,
      sortOrder: now
    }
    await db.memos.put(memo)
    setMemos((prev) => [...prev, memo])
    return memo
  }, [])

  const updateMemo = useCallback(async (id: string, patch: Partial<Memo>) => {
    const current = memosRef.current.find((m) => m.id === id)
    if (!current) return
    const next: Memo = { ...current, ...patch, updatedAt: Date.now() }
    setMemos((prev) => prev.map((m) => (m.id === id ? next : m)))
    await db.memos.put(next)
  }, [])

  const toggleDone = useCallback(async (id: string) => {
    const current = memosRef.current.find((m) => m.id === id)
    if (!current) return
    const done = !current.done
    const next: Memo = {
      ...current,
      done,
      doneAt: done ? Date.now() : undefined,
      updatedAt: Date.now()
    }
    setMemos((prev) => prev.map((m) => (m.id === id ? next : m)))
    await db.memos.put(next)
  }, [])

  const removeMemo = useCallback(async (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
    await db.memos.remove(id)
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
    await db.memos.putMany(changed)
  }, [])

  // --- テンプレート ---------------------------------------------------------

  const addTemplate = useCallback<Store['addTemplate']>(async (input) => {
    const now = Date.now()
    const t: Template = {
      ...input,
      id: uid(),
      builtin: false,
      createdAt: now,
      updatedAt: now,
      sortOrder: now
    }
    await db.templates.put(t)
    setTemplates((prev) => sortTemplates([...prev, t]))
    return t
  }, [])

  const updateTemplate = useCallback(async (id: string, patch: Partial<Template>) => {
    const current = templatesRef.current.find((t) => t.id === id)
    if (!current) return
    const next: Template = { ...current, ...patch, updatedAt: Date.now() }
    setTemplates((prev) => sortTemplates(prev.map((t) => (t.id === id ? next : t))))
    await db.templates.put(next)
  }, [])

  const removeTemplate = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    await db.templates.remove(id)
    // メモはスキーマを複製済みなので、テンプレートを消しても壊れない。
    // templateId だけ切って由来を外す(templateName は表示のため残す)
    const orphans = memosRef.current
      .filter((m) => m.templateId === id)
      .map((m) => ({ ...m, templateId: null }))
    if (orphans.length === 0) return
    const byId = new Map(orphans.map((m) => [m.id, m]))
    setMemos((prev) => prev.map((m) => byId.get(m.id) ?? m))
    await db.memos.putMany(orphans)
  }, [])

  const duplicateTemplate = useCallback(
    async (id: string) => {
      const source = templatesRef.current.find((t) => t.id === id)
      if (!source) return null
      const now = Date.now()
      const copy: Template = {
        ...source,
        id: uid(),
        name: `${source.name} のコピー`,
        // 項目のIDも振り直して、元テンプレートから独立させる
        fields: source.fields.map((f) => ({ ...f, id: uid() })),
        builtin: false,
        createdAt: now,
        updatedAt: now,
        sortOrder: now
      }
      await db.templates.put(copy)
      setTemplates((prev) => sortTemplates([...prev, copy]))
      return copy
    },
    []
  )

  const templateFromMemo = useCallback<Store['templateFromMemo']>(
    async (source, name, keepValues) => {
      const now = Date.now()
      const t: Template = {
        id: uid(),
        name,
        emoji: '📝',
        fields: source.fields.map((f) => toTemplateField(f, keepValues)),
        defaultLabels: [...source.labels],
        builtin: false,
        createdAt: now,
        updatedAt: now,
        sortOrder: now
      }
      await db.templates.put(t)
      setTemplates((prev) => sortTemplates([...prev, t]))
      return t
    },
    []
  )

  // --- ラベル ---------------------------------------------------------------

  const addLabel = useCallback(async (name: string) => {
    const label: Label = { id: uid(), name, sortOrder: Date.now() }
    await db.labels.put(label)
    setLabels((prev) => sortLabels([...prev, label]))
    return label
  }, [])

  const updateLabel = useCallback(async (id: string, patch: Partial<Label>) => {
    const current = labelsRef.current.find((l) => l.id === id)
    if (!current) return
    const next: Label = { ...current, ...patch }
    setLabels((prev) => sortLabels(prev.map((l) => (l.id === id ? next : l))))
    await db.labels.put(next)
  }, [])

  const removeLabel = useCallback(async (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id))
    await db.labels.remove(id)
    // メモとテンプレートに残った参照も外す
    const memoFix = memosRef.current
      .filter((m) => m.labels.includes(id))
      .map((m) => ({ ...m, labels: m.labels.filter((x) => x !== id) }))
    if (memoFix.length > 0) {
      const byId = new Map(memoFix.map((m) => [m.id, m]))
      setMemos((prev) => prev.map((m) => byId.get(m.id) ?? m))
      await db.memos.putMany(memoFix)
    }
    const tplFix = templatesRef.current
      .filter((t) => t.defaultLabels.includes(id))
      .map((t) => ({ ...t, defaultLabels: t.defaultLabels.filter((x) => x !== id) }))
    if (tplFix.length > 0) {
      const byId = new Map(tplFix.map((t) => [t.id, t]))
      setTemplates((prev) => prev.map((t) => byId.get(t.id) ?? t))
      await db.templates.putMany(tplFix)
    }
  }, [])

  // --- 単価計算・日次ログ(変更なし)----------------------------------------

  const saveComparison = useCallback(async (c: Omit<Comparison, 'id' | 'savedAt'>) => {
    const comp: Comparison = { ...c, id: uid(), savedAt: Date.now() }
    await db.comparisons.put(comp)
    setComparisons((prev) => [comp, ...prev])
    return comp
  }, [])

  const removeComparison = useCallback(async (id: string) => {
    setComparisons((prev) => prev.filter((c) => c.id !== id))
    await db.comparisons.remove(id)
  }, [])

  const addGoodNew = useCallback(async (text: string) => {
    const now = Date.now()
    const entry: GoodNew = { id: uid(), text, createdAt: now, updatedAt: now }
    await db.goodNews.put(entry)
    setGoodNews((prev) => [entry, ...prev])
    return entry
  }, [])

  const updateGoodNew = useCallback(async (id: string, text: string) => {
    const current = goodNewsRef.current.find((g) => g.id === id)
    if (!current) return
    const next: GoodNew = { ...current, text, updatedAt: Date.now() }
    setGoodNews((prev) => prev.map((g) => (g.id === id ? next : g)))
    await db.goodNews.put(next)
  }, [])

  const removeGoodNew = useCallback(async (id: string) => {
    setGoodNews((prev) => prev.filter((g) => g.id !== id))
    await db.goodNews.remove(id)
  }, [])

  const addActivityLog = useCallback(async (text: string) => {
    const now = Date.now()
    const entry: ActivityLog = { id: uid(), text, createdAt: now, updatedAt: now }
    await db.activityLogs.put(entry)
    setActivityLogs((prev) => [entry, ...prev])
    return entry
  }, [])

  const updateActivityLog = useCallback(async (id: string, text: string) => {
    const current = activityLogsRef.current.find((a) => a.id === id)
    if (!current) return
    const next: ActivityLog = { ...current, text, updatedAt: Date.now() }
    setActivityLogs((prev) => prev.map((a) => (a.id === id ? next : a)))
    await db.activityLogs.put(next)
  }, [])

  const removeActivityLog = useCallback(async (id: string) => {
    setActivityLogs((prev) => prev.filter((a) => a.id !== id))
    await db.activityLogs.remove(id)
  }, [])

  // --- 価格記録 -------------------------------------------------------------

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
    await db.products.put(product)
    setProducts((prev) => [product, ...prev])
    return product
  }, [])

  const updateProduct = useCallback(async (id: string, patch: Partial<ProductInput>) => {
    const current = productsRef.current.find((p) => p.id === id)
    if (!current) return
    const next: Product = { ...current, ...patch, updatedAt: Date.now() }
    setProducts((prev) => prev.map((p) => (p.id === id ? next : p)))
    await db.products.put(next)
  }, [])

  const removeProduct = useCallback(async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setPriceRecords((prev) => prev.filter((r) => r.productId !== id))
    await db.products.remove(id)
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
    await db.priceRecords.put(record)
    setPriceRecords((prev) => [...prev, record])
    return record
  }, [])

  const updatePriceRecord = useCallback(async (id: string, patch: Partial<PriceRecordInput>) => {
    const current = priceRecordsRef.current.find((r) => r.id === id)
    if (!current) return
    const next: PriceRecord = { ...current, ...patch, updatedAt: Date.now() }
    setPriceRecords((prev) => prev.map((r) => (r.id === id ? next : r)))
    await db.priceRecords.put(next)
  }, [])

  const removePriceRecord = useCallback(async (id: string) => {
    setPriceRecords((prev) => prev.filter((r) => r.id !== id))
    await db.priceRecords.remove(id)
  }, [])

  // --- 設定・バックアップ ---------------------------------------------------

  const setArchiveDays = useCallback(async (days: number) => {
    setArchiveDaysState(days)
    await db.setMeta('archiveDays', days)
  }, [])

  const markExported = useCallback(async () => {
    const now = Date.now()
    setLastExportAt(now)
    await db.setMeta('lastExportAt', now)
  }, [])

  const applyData = useCallback((d: db.DataSet) => {
    setMemos(d.memos)
    setTemplates(sortTemplates(d.templates))
    setLabels(sortLabels(d.labels))
    setComparisons([...d.comparisons].sort((a, b) => b.savedAt - a.savedAt))
    setGoodNews([...d.goodNews].sort((a, b) => b.createdAt - a.createdAt))
    setActivityLogs([...d.activityLogs].sort((a, b) => b.createdAt - a.createdAt))
    setProducts([...d.products].sort((a, b) => b.updatedAt - a.updatedAt))
    setPriceRecords(d.priceRecords)
  }, [])

  const importReplace = useCallback(
    async (data: db.DataSet) => {
      // テンプレートとラベルが空のバックアップで既定を失わないようにする
      const next: db.DataSet = {
        ...data,
        templates: data.templates.length > 0 ? data.templates : buildDefaultTemplates(),
        labels: data.labels.length > 0 ? data.labels : DEFAULT_LABELS
      }
      await db.replaceAllData(next)
      applyData(next)
    },
    [applyData]
  )

  const importMerge = useCallback(async (data: db.DataSet) => {
    await db.mergeAllData(data)
    const mergeById = <T extends { id: string }>(prev: T[], add: T[]) => {
      const map = new Map(prev.map((x) => [x.id, x]))
      for (const x of add) map.set(x.id, x)
      return [...map.values()]
    }
    setMemos((prev) => mergeById(prev, data.memos))
    setTemplates((prev) => sortTemplates(mergeById(prev, data.templates)))
    setLabels((prev) => sortLabels(mergeById(prev, data.labels)))
    setComparisons((prev) => mergeById(prev, data.comparisons).sort((a, b) => b.savedAt - a.savedAt))
    setGoodNews((prev) => mergeById(prev, data.goodNews).sort((a, b) => b.createdAt - a.createdAt))
    setActivityLogs((prev) =>
      mergeById(prev, data.activityLogs).sort((a, b) => b.createdAt - a.createdAt)
    )
    setProducts((prev) => mergeById(prev, data.products).sort((a, b) => b.updatedAt - a.updatedAt))
    setPriceRecords((prev) => mergeById(prev, data.priceRecords))
  }, [])

  const eraseAll = useCallback(async () => {
    await db.clearAllData()
    const tpls = buildDefaultTemplates()
    await db.labels.putMany(DEFAULT_LABELS)
    await db.templates.putMany(tpls)
    setMemos([])
    setTemplates(sortTemplates(tpls))
    setLabels(DEFAULT_LABELS)
    setComparisons([])
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
      templates,
      labels,
      comparisons,
      goodNews,
      activityLogs,
      products,
      priceRecords,
      archiveDays,
      lastExportAt,
      addMemo,
      draftFromTemplate,
      updateMemo,
      toggleDone,
      removeMemo,
      applySortOrders,
      addTemplate,
      updateTemplate,
      removeTemplate,
      duplicateTemplate,
      templateFromMemo,
      addLabel,
      updateLabel,
      removeLabel,
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
      ready, memos, templates, labels, comparisons, goodNews, activityLogs,
      products, priceRecords, archiveDays, lastExportAt,
      addMemo, draftFromTemplate, updateMemo, toggleDone, removeMemo, applySortOrders,
      addTemplate, updateTemplate, removeTemplate, duplicateTemplate, templateFromMemo,
      addLabel, updateLabel, removeLabel,
      saveComparison, removeComparison,
      addGoodNew, updateGoodNew, removeGoodNew,
      addActivityLog, updateActivityLog, removeActivityLog,
      addProduct, updateProduct, removeProduct,
      addPriceRecord, updatePriceRecord, removePriceRecord,
      setArchiveDays, markExported, importReplace, importMerge, eraseAll
    ]
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

function sortLabels(list: Label[]): Label[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja'))
}

function sortTemplates(list: Template[]): Template[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja'))
}

// 90日経過などの条件でバックアップのリマインドを表示(仕様書6章)
export function needsBackupReminder(
  store: Pick<Store, 'lastExportAt' | 'memos' | 'comparisons' | 'goodNews' | 'activityLogs'>
) {
  const hasData =
    store.memos.length > 0 ||
    store.comparisons.length > 0 ||
    store.goodNews.length > 0 ||
    store.activityLogs.length > 0
  if (!hasData) return false
  if (store.lastExportAt == null) return true
  return Date.now() - store.lastExportAt > EXPORT_REMIND_DAYS * 86_400_000
}
