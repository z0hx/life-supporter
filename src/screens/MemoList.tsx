import { useEffect, useMemo, useRef, useState } from 'react'
import type { Memo, SortBy, SortDir, ViewSettings } from '../types'
import { useStore } from '../store'
import { buildGroups, tagStyle, categoryStyle, type MemoGroup } from '../lib/memoGroups'
import {
  loadCollapsedGroups,
  loadViewSettings,
  saveCollapsedGroups,
  saveViewSettings
} from '../lib/viewSettings'
import { relativeTime } from '../lib/format'
import { RoundCheck } from '../components/RoundCheck'
import { Segmented } from '../components/Segmented'
import { MemoModal } from './MemoModal'

interface SortOption {
  label: string
  short: string
  sortBy: SortBy
  sortDir: SortDir
}

const SORT_OPTIONS: SortOption[] = [
  { label: '作成日時(新しい順)', short: '↓ 作成日時', sortBy: 'createdAt', sortDir: 'desc' },
  { label: '作成日時(古い順)', short: '↑ 作成日時', sortBy: 'createdAt', sortDir: 'asc' },
  { label: '更新日時(新しい順)', short: '↓ 更新日時', sortBy: 'updatedAt', sortDir: 'desc' },
  { label: '更新日時(古い順)', short: '↑ 更新日時', sortBy: 'updatedAt', sortDir: 'asc' },
  { label: '手動(ドラッグで並べ替え)', short: '⠿ 手動', sortBy: 'manual', sortDir: 'desc' }
]

export function MemoList({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore()
  const { memos, categories } = store
  const [vs, setVs] = useState<ViewSettings>(loadViewSettings)
  const [collapsed, setCollapsed] = useState<string[]>(loadCollapsedGroups)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Memo | 'new' | null>(null)

  // グルーピング/ソートの選択状態は永続化し次回起動時に復元
  useEffect(() => saveViewSettings(vs), [vs])
  useEffect(() => saveCollapsedGroups(collapsed), [collapsed])

  const filtered = useMemo(() => {
    if (!query.trim()) return memos
    const q = query.trim().toLowerCase()
    return memos.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.note ?? '').toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [memos, query])

  const groups = useMemo(() => buildGroups(filtered, categories, vs), [filtered, categories, vs])
  const currentSort =
    SORT_OPTIONS.find((o) =>
      vs.sortBy === 'manual' ? o.sortBy === 'manual' : o.sortBy === vs.sortBy && o.sortDir === vs.sortDir
    ) ?? SORT_OPTIONS[2]

  // 手動ソート時のグループ内並べ替え(未完了のみ対象)
  const reorderInGroup = (group: MemoGroup, memoId: string, delta: number) => {
    if (delta === 0) return
    const active = group.memos.filter((m) => !m.done)
    const from = active.findIndex((m) => m.id === memoId)
    if (from < 0) return
    const to = Math.max(0, Math.min(active.length - 1, from + delta))
    if (to === from) return
    const arr = [...active]
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    // 表示中の並びに既存の sortOrder 値を昇順で再割り当てし、全体の相対位置を保つ
    const orders = active.map((m) => m.sortOrder).sort((a, b) => a - b)
    store.applySortOrders(arr.map((m, i) => ({ id: m.id, sortOrder: orders[i] })))
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" aria-label="ホームへ戻る" onClick={() => navigate('/')}>
          ‹
        </button>
        <h1 className="screen-title">メモ</h1>
        <button
          className="header-action"
          style={{ color: searchOpen ? 'var(--accent)' : 'var(--ink-3)', fontSize: 17 }}
          aria-label="検索"
          onClick={() => {
            setSearchOpen((v) => !v)
            setQuery('')
          }}
        >
          🔍
        </button>
      </header>

      {searchOpen && (
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="タイトル・タグ・メモを検索…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <div className="memo-controls">
        <Segmented
          options={[
            { value: 'category', label: 'カテゴリ' },
            { value: 'tag', label: 'タグ' },
            { value: 'none', label: 'なし' }
          ]}
          value={vs.groupBy}
          onChange={(groupBy) => setVs((v) => ({ ...v, groupBy }))}
        />
        <button className="sort-btn" onClick={() => setSortMenuOpen(true)}>
          {currentSort.short} ▾
        </button>
      </div>

      <div className="memo-scroll">
        {groups.length === 0 && (
          <div className="memo-empty">
            {query ? '見つかりませんでした' : 'メモはまだありません。\n「＋ メモを追加」から始めましょう'}
          </div>
        )}
        {groups.map((g) => {
          const isCollapsed = collapsed.includes(g.key)
          return (
            <section key={g.key} className={g.faded ? 'memo-group--faded' : undefined}>
              <button
                className="memo-group-header"
                style={{ color: g.color }}
                onClick={() =>
                  setCollapsed((prev) =>
                    prev.includes(g.key) ? prev.filter((k) => k !== g.key) : [...prev, g.key]
                  )
                }
              >
                {g.emoji ? `${g.emoji} ` : ''}
                {g.label}
                <span className="count">{g.memos.length}</span>
                <span className={`chevron${isCollapsed ? ' chevron--collapsed' : ''}`}>▾</span>
              </button>
              {!isCollapsed && (
                <div className="memo-card">
                  {g.memos.map((m) => (
                    <MemoRow
                      key={m.id}
                      memo={m}
                      showCategory={vs.groupBy !== 'category'}
                      manualSort={vs.sortBy === 'manual' && !m.done}
                      categoryLabel={categories.find((c) => c.id === m.category)?.label ?? 'その他'}
                      onToggle={() => store.toggleDone(m.id)}
                      onOpen={() => setEditing(m)}
                      onDelete={() => store.removeMemo(m.id)}
                      onReorder={(delta) => reorderInGroup(g, m.id, delta)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <button className="fab" onClick={() => setEditing('new')}>
        ＋ メモを追加
      </button>

      {sortMenuOpen && (
        <div className="menu-overlay" onClick={() => setSortMenuOpen(false)}>
          <div className="sort-menu" onClick={(e) => e.stopPropagation()}>
            {SORT_OPTIONS.map((o) => {
              const on = o === currentSort
              return (
                <button
                  key={o.label}
                  onClick={() => {
                    setVs((v) => ({ ...v, sortBy: o.sortBy, sortDir: o.sortDir }))
                    setSortMenuOpen(false)
                  }}
                >
                  <span style={on ? { fontWeight: 900 } : undefined}>{o.label}</span>
                  <span className={`radio${on ? ' radio--on' : ''}`} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {editing && (
        <MemoModal memo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

const SWIPE_OPEN = -76

function MemoRow({
  memo,
  showCategory,
  manualSort,
  categoryLabel,
  onToggle,
  onOpen,
  onDelete,
  onReorder
}: {
  memo: Memo
  showCategory: boolean
  manualSort: boolean
  categoryLabel: string
  onToggle: () => void
  onOpen: () => void
  onDelete: () => void
  onReorder: (delta: number) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [swipeOpen, setSwipeOpen] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const [dragY, setDragY] = useState<number | null>(null)
  const gesture = useRef<{ x: number; y: number; mode: 'none' | 'swipe' | 'cancel' } | null>(null)
  const suppressClick = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle, .check, .memo-row-delete')) return
    gesture.current = { x: e.clientX, y: e.clientY, mode: 'none' }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || g.mode === 'cancel') return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.mode === 'none') {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        g.mode = 'swipe'
        rowRef.current?.setPointerCapture(e.pointerId)
      } else if (Math.abs(dy) > 8) {
        g.mode = 'cancel'
        return
      } else {
        return
      }
    }
    const base = swipeOpen ? SWIPE_OPEN : 0
    setDragX(Math.max(SWIPE_OPEN - 12, Math.min(0, base + dx)))
  }
  const endSwipe = () => {
    const g = gesture.current
    gesture.current = null
    if (g?.mode === 'swipe') {
      suppressClick.current = true
      if (dragX !== null) setSwipeOpen(dragX < SWIPE_OPEN / 2)
    }
    setDragX(null)
  }

  // 手動ソート時のドラッグハンドル
  const handleDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const rowH = rowRef.current?.offsetHeight ?? 56
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => setDragY(ev.clientY - startY)
    const up = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      setDragY(null)
      onReorder(Math.round((ev.clientY - startY) / rowH))
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const translate =
    dragY !== null
      ? `translateY(${dragY}px)`
      : `translateX(${dragX ?? (swipeOpen ? SWIPE_OPEN : 0)}px)`

  return (
    <div className="memo-row-wrap">
      <button
        className="memo-row-delete"
        tabIndex={swipeOpen ? 0 : -1}
        aria-hidden={!swipeOpen}
        onClick={onDelete}
      >
        削除
      </button>
      <div
        ref={rowRef}
        className={`memo-row${memo.done ? ' memo-row--done' : ''}${dragY !== null ? ' memo-row--dragging' : ''}`}
        style={{ transform: translate }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          if (swipeOpen) {
            setSwipeOpen(false)
          } else {
            onOpen()
          }
        }}
      >
        <RoundCheck done={memo.done} onToggle={onToggle} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="memo-row-title">{memo.title}</div>
          <div className="memo-row-meta">
            {memo.priority === 'high' && !memo.done && <span className="priority-dot">高</span>}
            {showCategory && (
              <span
                className="tag-chip"
                style={{
                  color: categoryStyle(memo.category).color,
                  background: categoryStyle(memo.category).bg
                }}
              >
                {categoryLabel}
              </span>
            )}
            {memo.tags.map((t) => (
              <span
                key={t}
                className="tag-chip"
                style={{ color: tagStyle(t).color, background: tagStyle(t).bg }}
              >
                #{t}
              </span>
            ))}
            <span className="memo-row-time">{relativeTime(memo.updatedAt)}</span>
          </div>
        </div>
        {manualSort && (
          <span className="drag-handle" onPointerDown={handleDrag} aria-label="ドラッグで並べ替え">
            ⠿
          </span>
        )}
      </div>
    </div>
  )
}
