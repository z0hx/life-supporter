import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ActivityLog, Comparison, GoodNew, Label, Memo, Template } from '../types'

interface LifeSupporterDB extends DBSchema {
  memos: { key: string; value: Memo }
  templates: { key: string; value: Template }
  labels: { key: string; value: Label }
  comparisons: { key: string; value: Comparison }
  goodNews: { key: string; value: GoodNew }
  activityLogs: { key: string; value: ActivityLog }
  meta: { key: string; value: unknown }
}

const DB_NAME = 'life-supporter'
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase<LifeSupporterDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LifeSupporterDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v4 でメモをテンプレート式に刷新した。旧メモ(v3以前)は構造が根本的に異なるため
        // 移行せず作り直す。categories はラベルに統合されたので破棄する。
        // 単価計算・日次ログのストアは影響を受けない
        if (oldVersion > 0 && oldVersion < 4) {
          if (db.objectStoreNames.contains('memos')) db.deleteObjectStore('memos')
          // @ts-expect-error v3 までの旧ストア。現行のスキーマ型には存在しない
          if (db.objectStoreNames.contains('categories')) db.deleteObjectStore('categories')
        }
        if (!db.objectStoreNames.contains('memos')) db.createObjectStore('memos', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('templates'))
          db.createObjectStore('templates', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('labels'))
          db.createObjectStore('labels', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('comparisons'))
          db.createObjectStore('comparisons', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('goodNews'))
          db.createObjectStore('goodNews', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('activityLogs'))
          db.createObjectStore('activityLogs', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      }
    })
  }
  return dbPromise
}

// idb の put/getAll をストアごとに薄く包む。すべて同じ形なので共通化しておく
function crud<S extends 'memos' | 'templates' | 'labels' | 'comparisons' | 'goodNews' | 'activityLogs'>(
  store: S
) {
  type V = LifeSupporterDB[S]['value']
  return {
    getAll: async (): Promise<V[]> => (await getDB()).getAll(store) as Promise<V[]>,
    put: async (value: V) => {
      await (await getDB()).put(store, value as never)
    },
    putMany: async (values: V[]) => {
      const tx = (await getDB()).transaction(store, 'readwrite')
      await Promise.all(values.map((v) => tx.store.put(v as never)))
      await tx.done
    },
    remove: async (id: string) => {
      await (await getDB()).delete(store, id)
    }
  }
}

export const memos = crud('memos')
export const templates = crud('templates')
export const labels = crud('labels')
export const comparisons = crud('comparisons')
export const goodNews = crud('goodNews')
export const activityLogs = crud('activityLogs')

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDB()).get('meta', key)) as T | undefined
}
export async function setMeta(key: string, value: unknown) {
  await (await getDB()).put('meta', value, key)
}

const ALL_STORES = [
  'memos',
  'templates',
  'labels',
  'comparisons',
  'goodNews',
  'activityLogs'
] as const

export async function clearAllData() {
  const db = await getDB()
  const tx = db.transaction([...ALL_STORES, 'meta'], 'readwrite')
  await Promise.all([
    ...ALL_STORES.map((s) => tx.objectStore(s).clear()),
    tx.objectStore('meta').clear()
  ])
  await tx.done
}

export interface DataSet {
  memos: Memo[]
  templates: Template[]
  labels: Label[]
  comparisons: Comparison[]
  goodNews: GoodNew[]
  activityLogs: ActivityLog[]
}

export async function replaceAllData(data: DataSet) {
  const db = await getDB()
  const tx = db.transaction(ALL_STORES, 'readwrite')
  await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()))
  await Promise.all(
    ALL_STORES.flatMap((s) => data[s].map((v) => tx.objectStore(s).put(v as never)))
  )
  await tx.done
}

export async function mergeAllData(data: DataSet) {
  const db = await getDB()
  const tx = db.transaction(ALL_STORES, 'readwrite')
  await Promise.all(
    ALL_STORES.flatMap((s) => data[s].map((v) => tx.objectStore(s).put(v as never)))
  )
  await tx.done
}
