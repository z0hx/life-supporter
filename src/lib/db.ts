import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ActivityLog, Category, Comparison, GoodNew, Memo, PriceRecord, Product } from '../types'

interface LifeSupporterDB extends DBSchema {
  memos: { key: string; value: Memo }
  comparisons: { key: string; value: Comparison }
  categories: { key: string; value: Category }
  goodNews: { key: string; value: GoodNew }
  activityLogs: { key: string; value: ActivityLog }
  products: { key: string; value: Product }
  priceRecords: { key: string; value: PriceRecord }
  meta: { key: string; value: unknown }
}

const DB_NAME = 'life-supporter'
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase<LifeSupporterDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LifeSupporterDB>(DB_NAME, DB_VERSION, {
      // 新規インストール(oldVersion=0)・既存 v1 の両方で動くよう、
      // 未作成のストアだけを作成する
      upgrade(db) {
        if (!db.objectStoreNames.contains('memos')) db.createObjectStore('memos', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('comparisons'))
          db.createObjectStore('comparisons', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('categories'))
          db.createObjectStore('categories', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('goodNews'))
          db.createObjectStore('goodNews', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('activityLogs'))
          db.createObjectStore('activityLogs', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('priceRecords'))
          db.createObjectStore('priceRecords', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      }
    })
  }
  return dbPromise
}

export async function getAllMemos() {
  return (await getDB()).getAll('memos')
}
export async function putMemo(memo: Memo) {
  await (await getDB()).put('memos', memo)
}
export async function putMemos(memos: Memo[]) {
  const tx = (await getDB()).transaction('memos', 'readwrite')
  await Promise.all(memos.map((m) => tx.store.put(m)))
  await tx.done
}
export async function deleteMemo(id: string) {
  await (await getDB()).delete('memos', id)
}

export async function getAllComparisons() {
  return (await getDB()).getAll('comparisons')
}
export async function putComparison(c: Comparison) {
  await (await getDB()).put('comparisons', c)
}
export async function putComparisons(cs: Comparison[]) {
  const tx = (await getDB()).transaction('comparisons', 'readwrite')
  await Promise.all(cs.map((c) => tx.store.put(c)))
  await tx.done
}
export async function deleteComparison(id: string) {
  await (await getDB()).delete('comparisons', id)
}

export async function getAllGoodNews() {
  return (await getDB()).getAll('goodNews')
}
export async function putGoodNew(g: GoodNew) {
  await (await getDB()).put('goodNews', g)
}
export async function putGoodNews(gs: GoodNew[]) {
  const tx = (await getDB()).transaction('goodNews', 'readwrite')
  await Promise.all(gs.map((g) => tx.store.put(g)))
  await tx.done
}
export async function deleteGoodNew(id: string) {
  await (await getDB()).delete('goodNews', id)
}

export async function getAllActivityLogs() {
  return (await getDB()).getAll('activityLogs')
}
export async function putActivityLog(a: ActivityLog) {
  await (await getDB()).put('activityLogs', a)
}
export async function putActivityLogs(as: ActivityLog[]) {
  const tx = (await getDB()).transaction('activityLogs', 'readwrite')
  await Promise.all(as.map((a) => tx.store.put(a)))
  await tx.done
}
export async function deleteActivityLog(id: string) {
  await (await getDB()).delete('activityLogs', id)
}

export async function getAllProducts() {
  return (await getDB()).getAll('products')
}
export async function putProduct(p: Product) {
  await (await getDB()).put('products', p)
}
export async function putProducts(ps: Product[]) {
  const tx = (await getDB()).transaction('products', 'readwrite')
  await Promise.all(ps.map((p) => tx.store.put(p)))
  await tx.done
}
export async function deleteProduct(id: string) {
  await (await getDB()).delete('products', id)
}

export async function getAllPriceRecords() {
  return (await getDB()).getAll('priceRecords')
}
export async function putPriceRecord(r: PriceRecord) {
  await (await getDB()).put('priceRecords', r)
}
export async function putPriceRecords(rs: PriceRecord[]) {
  const tx = (await getDB()).transaction('priceRecords', 'readwrite')
  await Promise.all(rs.map((r) => tx.store.put(r)))
  await tx.done
}
export async function deletePriceRecord(id: string) {
  await (await getDB()).delete('priceRecords', id)
}
// 商品を削除する際、紐づく価格記録も一括で消す
export async function deletePriceRecordsByProduct(productId: string) {
  const db = await getDB()
  const tx = db.transaction('priceRecords', 'readwrite')
  const all = await tx.store.getAll()
  await Promise.all(
    all.filter((r) => r.productId === productId).map((r) => tx.store.delete(r.id))
  )
  await tx.done
}

export async function getAllCategories() {
  return (await getDB()).getAll('categories')
}
export async function putCategory(c: Category) {
  await (await getDB()).put('categories', c)
}
export async function putCategories(cs: Category[]) {
  const tx = (await getDB()).transaction('categories', 'readwrite')
  await Promise.all(cs.map((c) => tx.store.put(c)))
  await tx.done
}
export async function deleteCategory(id: string) {
  await (await getDB()).delete('categories', id)
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDB()).get('meta', key)) as T | undefined
}
export async function setMeta(key: string, value: unknown) {
  await (await getDB()).put('meta', value, key)
}

export async function clearAllData() {
  const db = await getDB()
  const tx = db.transaction(
    ['memos', 'comparisons', 'categories', 'goodNews', 'activityLogs', 'products', 'priceRecords', 'meta'],
    'readwrite'
  )
  await Promise.all([
    tx.objectStore('memos').clear(),
    tx.objectStore('comparisons').clear(),
    tx.objectStore('categories').clear(),
    tx.objectStore('goodNews').clear(),
    tx.objectStore('activityLogs').clear(),
    tx.objectStore('products').clear(),
    tx.objectStore('priceRecords').clear(),
    tx.objectStore('meta').clear()
  ])
  await tx.done
}

export async function replaceAllData(
  memos: Memo[],
  comparisons: Comparison[],
  categories: Category[],
  goodNews: GoodNew[],
  activityLogs: ActivityLog[],
  products: Product[],
  priceRecords: PriceRecord[]
) {
  const db = await getDB()
  const tx = db.transaction(
    ['memos', 'comparisons', 'categories', 'goodNews', 'activityLogs', 'products', 'priceRecords'],
    'readwrite'
  )
  await Promise.all([
    tx.objectStore('memos').clear(),
    tx.objectStore('comparisons').clear(),
    tx.objectStore('categories').clear(),
    tx.objectStore('goodNews').clear(),
    tx.objectStore('activityLogs').clear(),
    tx.objectStore('products').clear(),
    tx.objectStore('priceRecords').clear()
  ])
  await Promise.all([
    ...memos.map((m) => tx.objectStore('memos').put(m)),
    ...comparisons.map((c) => tx.objectStore('comparisons').put(c)),
    ...categories.map((c) => tx.objectStore('categories').put(c)),
    ...goodNews.map((g) => tx.objectStore('goodNews').put(g)),
    ...activityLogs.map((a) => tx.objectStore('activityLogs').put(a)),
    ...products.map((p) => tx.objectStore('products').put(p)),
    ...priceRecords.map((r) => tx.objectStore('priceRecords').put(r))
  ])
  await tx.done
}
