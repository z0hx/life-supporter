import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  ActivityLog,
  Comparison,
  GoodNew,
  Label,
  Memo,
  MemoField,
  Priority,
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

  setArchiveDays: (days: number) => Promise<void>
  markExported: () => Promise<void>
  importReplace: (data: db.DataSet) => Promise<void>
  importMerge: (data: db.DataSet) => Promise<void>
  eraseAll: () => Promise<void>
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [memos, setMemos] = useState<Memo[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [labels, setLabels] = useState<Label[]>(DEFAULT_LABELS)
  const [comparisons, setComparisons] = useState<Comparison[]>([])
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
      if (cancelled) return
      setLabels(sortLabels(labs))
      setTemplates(sortTemplates(tpls))
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
    let next: Memo | undefined
    setMemos((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        next = { ...m, ...patch, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.memos.put(next)
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
    if (next) await db.memos.put(next)
  }, [])

  const removeMemo = useCallback(async (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
    await db.memos.remove(id)
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
    if (changed.length > 0) await db.memos.putMany(changed)
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
    let next: Template | undefined
    setTemplates((prev) =>
      sortTemplates(
        prev.map((t) => {
          if (t.id !== id) return t
          next = { ...t, ...patch, updatedAt: Date.now() }
          return next
        })
      )
    )
    if (next) await db.templates.put(next)
  }, [])

  const removeTemplate = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    await db.templates.remove(id)
    // メモはスキーマを複製済みなので、テンプレートを消しても壊れない。
    // templateId だけ切って由来を外す(templateName は表示のため残す)
    setMemos((prev) => {
      const orphans = prev.filter((m) => m.templateId === id)
      if (orphans.length === 0) return prev
      const updated = orphans.map((m) => ({ ...m, templateId: null }))
      void db.memos.putMany(updated)
      const byId = new Map(updated.map((m) => [m.id, m]))
      return prev.map((m) => byId.get(m.id) ?? m)
    })
  }, [])

  const duplicateTemplate = useCallback(
    async (id: string) => {
      const source = templates.find((t) => t.id === id)
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
    [templates]
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
    let next: Label | undefined
    setLabels((prev) =>
      sortLabels(
        prev.map((l) => {
          if (l.id !== id) return l
          next = { ...l, ...patch }
          return next
        })
      )
    )
    if (next) await db.labels.put(next)
  }, [])

  const removeLabel = useCallback(async (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id))
    await db.labels.remove(id)
    // メモに残った参照も外す
    setMemos((prev) => {
      const affected = prev.filter((m) => m.labels.includes(id))
      if (affected.length === 0) return prev
      const updated = affected.map((m) => ({ ...m, labels: m.labels.filter((x) => x !== id) }))
      void db.memos.putMany(updated)
      const byId = new Map(updated.map((m) => [m.id, m]))
      return prev.map((m) => byId.get(m.id) ?? m)
    })
    setTemplates((prev) => {
      const affected = prev.filter((t) => t.defaultLabels.includes(id))
      if (affected.length === 0) return prev
      const updated = affected.map((t) => ({
        ...t,
        defaultLabels: t.defaultLabels.filter((x) => x !== id)
      }))
      void db.templates.putMany(updated)
      const byId = new Map(updated.map((t) => [t.id, t]))
      return prev.map((t) => byId.get(t.id) ?? t)
    })
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
    let next: GoodNew | undefined
    setGoodNews((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        next = { ...g, text, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.goodNews.put(next)
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
    let next: ActivityLog | undefined
    setActivityLogs((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        next = { ...a, text, updatedAt: Date.now() }
        return next
      })
    )
    if (next) await db.activityLogs.put(next)
  }, [])

  const removeActivityLog = useCallback(async (id: string) => {
    setActivityLogs((prev) => prev.filter((a) => a.id !== id))
    await db.activityLogs.remove(id)
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
      setArchiveDays,
      markExported,
      importReplace,
      importMerge,
      eraseAll
    }),
    [
      ready, memos, templates, labels, comparisons, goodNews, activityLogs, archiveDays, lastExportAt,
      addMemo, draftFromTemplate, updateMemo, toggleDone, removeMemo, applySortOrders,
      addTemplate, updateTemplate, removeTemplate, duplicateTemplate, templateFromMemo,
      addLabel, updateLabel, removeLabel,
      saveComparison, removeComparison,
      addGoodNew, updateGoodNew, removeGoodNew,
      addActivityLog, updateActivityLog, removeActivityLog,
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
