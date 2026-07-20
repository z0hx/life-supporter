import { useStore } from '../store'
import { formatToday, isSameDay } from '../lib/format'
import { compareMemos } from '../lib/memoGroups'
import { findCheapest, unitModeDef, unitPrice } from '../lib/calc'
import { DEFAULT_VIEW_SETTINGS } from '../lib/viewSettings'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'おつかれさま、夜ふかしさん'
  if (h < 11) return 'おはようございます'
  if (h < 18) return 'こんにちは'
  return '今日も、おつかれさま'
}

export function Home({ navigate }: { navigate: (r: string) => void }) {
  const { memos, comparisons, goodNews, activityLogs, products } = useStore()
  const active = memos.filter((m) => !m.archived && !m.done)
  const recordedToday = goodNews.some((g) => isSameDay(g.createdAt))
  const loggedToday = activityLogs.some((a) => isSameDay(a.createdAt))
  const preview = [...active].sort((a, b) => compareMemos(a, b, DEFAULT_VIEW_SETTINGS)).slice(0, 2)

  const last = comparisons[0]
  let hint: string | null = null
  if (last) {
    const mode = unitModeDef(last.unitMode)
    const prices = last.items.map((it) => unitPrice(it.price, it.amount, last.unitMode))
    const best = findCheapest(prices)
    if (best) {
      const label = last.items[best.index].label || last.name || `商品${best.index + 1}`
      hint = `前回の比較:${label}が ${best.percent}% お得でした`
    } else if (last.name) {
      hint = `前回の比較:${last.name}(${mode.label})`
    }
  }

  const productHint = products.length === 0 ? '店ごとの値段をくらべる' : `${products.length}商品を記録中`

  return (
    <div className="screen home-screen">
      <div className="home-hero">
        <div className="home-brand">life-supporter</div>
        <h1 className="home-greeting">{greeting()}</h1>
        <div className="home-date">{formatToday()}</div>
      </div>
      <div className="home-grid">
        <button className="home-card home-card--memo" onClick={() => navigate('/memos')}>
          <div className="home-card-head">
            <span className="home-card-title">📝 メモ</span>
            <span className="home-card-link">{active.length}件 →</span>
          </div>
          {preview.length > 0 ? (
            <div className="home-memo-preview">
              {preview.map((m) => (
                <div key={m.id} className="row">
                  <span className="check" aria-hidden="true" />
                  {m.title}
                </div>
              ))}
            </div>
          ) : (
            <div className="home-memo-empty">メモはまだありません。気になったことを残しておきましょう</div>
          )}
        </button>
        <button
          className="home-card home-card--daylog"
          onClick={() => navigate('/goodnew')}
        >
          <div className="home-card-head">
            <span className="home-card-title">🌱 Good &amp; New</span>
            <span className="home-card-link">
              {goodNews.length > 0 ? `${goodNews.length}件 →` : '→'}
            </span>
          </div>
          <div className={`home-daylog-prompt${recordedToday ? ' home-daylog-prompt--done' : ''}`}>
            {recordedToday ? '今日は記録済み ✓' : '今日はまだ記録していません'}
          </div>
        </button>
        <button
          className="home-card home-card--daylog"
          onClick={() => navigate('/activity')}
        >
          <div className="home-card-head">
            <span className="home-card-title">📔 行動記録</span>
            <span className="home-card-link">
              {activityLogs.length > 0 ? `${activityLogs.length}件 →` : '→'}
            </span>
          </div>
          <div className={`home-daylog-prompt${loggedToday ? ' home-daylog-prompt--done' : ''}`}>
            {loggedToday ? '今日は記録済み ✓' : '今日はまだ記録していません'}
          </div>
        </button>
        <button className="home-card" onClick={() => navigate('/calc')}>
          <div className="home-tile-icon">¥</div>
          <div className="home-tile-title">単価計算</div>
          <div className="home-tile-sub">お得はどっち?</div>
        </button>
        <button className="home-card" onClick={() => navigate('/products')}>
          <div className="home-tile-icon">💰</div>
          <div className="home-tile-title">価格記録</div>
          <div className="home-tile-sub">{productHint}</div>
        </button>
      </div>
      {hint && (
        <button className="home-hint" onClick={() => navigate('/history')}>
          <span aria-hidden="true">💡</span>
          {hint}
        </button>
      )}
      <div className="home-footer">
        <button className="home-settings-link" onClick={() => navigate('/settings')}>
          ⚙ 設定 · v1.0
        </button>
      </div>
    </div>
  )
}
