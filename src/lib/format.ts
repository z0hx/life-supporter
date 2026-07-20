const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function formatToday(now = new Date()) {
  return `${now.getMonth() + 1}月${now.getDate()}日(${WEEKDAYS[now.getDay()]})`
}

export function formatDateTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 相対時刻(メモ行のメタ表示用)
export function relativeTime(ts: number, now = Date.now()) {
  const diff = now - ts
  const min = 60_000
  const hour = 60 * min
  if (diff < min) return 'たった今'
  if (diff < hour) return `${Math.floor(diff / min)}分前`
  const d = new Date(ts)
  const n = new Date(now)
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(n) - startOfDay(d)) / 86_400_000)
  if (dayDiff === 0) return `${Math.floor(diff / hour)}時間前`
  if (dayDiff === 1) return '昨日'
  if (d.getFullYear() === n.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// Good & New の日付見出し(今日 / 昨日 / M月D日(曜))
export function formatDayLabel(ts: number, now = Date.now()) {
  const d = new Date(ts)
  const n = new Date(now)
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(n) - startOfDay(d)) / 86_400_000)
  if (dayDiff === 0) return '今日'
  if (dayDiff === 1) return '昨日'
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`
}

// 同じカレンダー日か(「今日記録済み」判定などに使用)
export function isSameDay(ts: number, now = Date.now()) {
  const d = new Date(ts)
  const n = new Date(now)
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

// <input type="date"> 用の 'YYYY-MM-DD' 文字列に変換
export function toDateInputValue(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 'YYYY-MM-DD' 文字列をローカル日付の epoch ms に変換(不正な値は現在時刻)
export function fromDateInputValue(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return Date.now()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

export function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
