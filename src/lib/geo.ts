import type { LocationValue } from '../types'

// 東京駅。座標がまだ無いときの地図の初期位置
export const FALLBACK_CENTER = { lat: 35.6812, lng: 139.7671 }
export const DEFAULT_ZOOM = 16

export function hasCoords(v: LocationValue): v is LocationValue & { lat: number; lng: number } {
  return typeof v.lat === 'number' && typeof v.lng === 'number'
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// 端末の地図アプリで開く。iOS は Apple マップ、それ以外は Google マップ
export function mapAppUrl(v: LocationValue): string | null {
  if (hasCoords(v)) {
    const q = encodeURIComponent(v.name || v.address || '')
    return isIOS()
      ? `https://maps.apple.com/?ll=${v.lat},${v.lng}${q ? `&q=${q}` : ''}`
      : `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`
  }
  const text = v.address || v.name
  if (!text) return null
  const q = encodeURIComponent(text)
  return isIOS()
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`
}

// --- Nominatim --------------------------------------------------------------
// 利用規約により 1秒1リクエストまで。逐次入力での問い合わせは禁止されているため、
// 呼び出しは必ずユーザーの明示操作(検索ボタン・地点確定)からのみ行う

const NOMINATIM = 'https://nominatim.openstreetmap.org'
let lastCallAt = 0

async function request<T>(path: string): Promise<T> {
  const wait = 1000 - (Date.now() - lastCallAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
  const res = await fetch(`${NOMINATIM}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  return res.json() as Promise<T>
}

interface NominatimPlace {
  lat: string
  lon: string
  name?: string
  display_name: string
}

export interface GeoResult {
  name: string
  address: string
  lat: number
  lng: number
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const q = query.trim()
  if (!q) return []
  const places = await request<NominatimPlace[]>(
    `/search?format=jsonv2&limit=5&accept-language=ja&q=${encodeURIComponent(q)}`
  )
  return places.map((p) => ({
    name: p.name || p.display_name.split(',')[0].trim(),
    address: p.display_name,
    lat: Number(p.lat),
    lng: Number(p.lon)
  }))
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const p = await request<NominatimPlace>(
      `/reverse?format=jsonv2&accept-language=ja&lat=${lat}&lon=${lng}`
    )
    return p.display_name ?? null
  } catch {
    // 住所が取れなくても座標は保存できるので、失敗は握りつぶす
    return null
  }
}

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('この端末では現在地を取得できません'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? '位置情報の利用が許可されていません'
              : '現在地を取得できませんでした'
          )
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  })
}
