import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { ActivityLog, Category, Comparison, GoodNew, Memo } from './types'
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
  setArchiveDays: (days: number) => Promise<void>
  markExported: () => Promise<void>
  importReplace: (memos: Memo[], comparisons: Comparison[], categories: Category[], goodNews: GoodNew[], activityLogs: ActivityLog[]) => Promise<void>
  importMerge: (memos: Memo[], comparisons: Comparison[], categories: Category[], goodNews: GoodNew[], activityLogs: ActivityLog[]) => Promise<void>
  eraseAll: () => Promise<void>
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [memos, setMemos] = useState<Memo[]>([])
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [goodNews, setGoodNews] = useState<GoodNew[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [archiveDays, setArchiveDaysState] = useState(DEFAULT_ARCHIVE_DAYS)
  const [lastExportAt, setLastExportAt] = useState<number | null>(null)

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
      if (cancelled) return
      setCategories(sortCategories(cats))
      setArchiveDaysState(days)
      setLastExportAt(exported)
      setMemos(all)
      setComparisons(comps.sort((a, b) => b.savedAt - a.savedAt))
      setGoodNews(gn.sort((a, b) => b.createdAt - a.createdAt))
      setActivityLogs(al.sort((a, b) => b.createdAt - a.createdAt))
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
    let next: Memo | undefined
    setMemos((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        next = { ...m, ...patch, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.putMemo(next)
  }, [])

  const toggleDone = useCallback(async (id: string) => {
    let next: Memo | undefined
    setMemos((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        const done = !m.done
        next = { ...m, done, doneAt: done ? Date.now() : undefined, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.putMemo(next)
  }, [])

  const removeMemo = useCallback(async (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
    await db.deleteMemo(id)
  }, [])

  const applySortOrders = useCallback(async (orders: { id: string; sortOrder: number }[]) => {
    const map = new Map(orders.map((o) => [o.id, o.sortOrder]))
    const changed: Memo[] = []
    setMemos((prev) =>
      prev.map((m) => {
        const so = map.get(m.id)
        if (so === undefined || so === m.sortOrder) return m
        const next = { ...m, sortOrder: so }
        changed.push(next)
        return next
      })
    )
    if (changed.length > 0) await db.putMemos(changed)
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
    let next: GoodNew | undefined
    setGoodNews((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        next = { ...g, text, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.putGoodNew(next)
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
    let next: ActivityLog | undefined
    setActivityLogs((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        next = { ...a, text, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.putActivityLog(next)
  }, [])

  const removeActivityLog = useCallback(async (id: string) => {
    setActivityLogs((prev) => prev.filter((a) => a.id !== id))
    await db.deleteActivityLog(id)
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
    async (m: Memo[], c: Comparison[], cats: Category[], gn: GoodNew[], al: ActivityLog[]) => {
      const nextCats = cats.length > 0 ? cats : DEFAULT_CATEGORIES
      await db.replaceAllData(m, c, nextCats, gn, al)
      setMemos(m)
      setComparisons([...c].sort((a, b) => b.savedAt - a.savedAt))
      setCategories(sortCategories(nextCats))
      setGoodNews([...gn].sort((a, b) => b.createdAt - a.createdAt))
      setActivityLogs([...al].sort((a, b) => b.createdAt - a.createdAt))
    },
    []
  )

  const importMerge = useCallback(
    async (m: Memo[], c: Comparison[], cats: Category[], gn: GoodNew[], al: ActivityLog[]) => {
      await Promise.all([
        db.putMemos(m),
        db.putComparisons(c),
        db.putCategories(cats),
        db.putGoodNews(gn),
        db.putActivityLogs(al)
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
      setArchiveDays,
      markExported,
      importReplace,
      importMerge,
      eraseAll
    }),
    [
      ready, memos, comparisons, categories, goodNews, activityLogs, archiveDays, lastExportAt,
      addMemo, updateMemo, toggleDone, removeMemo, applySortOrders,
      addCategory, removeCategory, saveComparison, removeComparison,
      addGoodNew, updateGoodNew, removeGoodNew,
      addActivityLog, updateActivityLog, removeActivityLog,
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
