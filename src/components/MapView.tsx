import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// このファイルだけが leaflet に依存する。動的 import されるため初期バンドルには入らない。
// タイルは差し替え可能にしてある(OSM は個人利用の範囲での利用が前提)
export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export interface MapCenter {
  lat: number
  lng: number
  zoom: number
}

// 既定のマーカー画像はバンドラでパスが壊れやすいので、divIcon + CSS で描く
function pinIcon() {
  return L.divIcon({
    className: 'map-pin-icon',
    html: '<span class="map-pin"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  })
}

export default function MapView({
  center,
  zoom,
  interactive,
  showMarker,
  tileUrl,
  attribution,
  recenterKey = 0,
  onMoveEnd,
  onTileError
}: {
  center: { lat: number; lng: number }
  zoom: number
  interactive: boolean
  /** 中央固定ピンで選ばせる場合は false、地点を示すだけなら true */
  showMarker?: boolean
  tileUrl?: string
  attribution?: string
  /** 値を増やすと center へ強制的に移動する(現在地・検索結果の反映用) */
  recenterKey?: number
  onMoveEnd?: (c: MapCenter) => void
  onTileError?: () => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  // moveend のたびに map を作り直さないよう、コールバックは ref 経由で最新を見る
  const onMoveEndRef = useRef(onMoveEnd)
  onMoveEndRef.current = onMoveEnd
  const onTileErrorRef = useRef(onTileError)
  onTileErrorRef.current = onTileError

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      scrollWheelZoom: interactive,
      boxZoom: false,
      keyboard: interactive
    })
    const layer = L.tileLayer(tileUrl ?? DEFAULT_TILE_URL, {
      attribution: attribution ?? DEFAULT_ATTRIBUTION,
      maxZoom: 19
    })
    layer.on('tileerror', () => onTileErrorRef.current?.())
    layer.addTo(map)

    if (showMarker) {
      markerRef.current = L.marker([center.lat, center.lng], {
        icon: pinIcon(),
        interactive: false
      }).addTo(map)
    }
    map.on('moveend', () => {
      const c = map.getCenter()
      onMoveEndRef.current?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    })

    // モーダル内で開くと初期サイズが確定しておらずタイルがずれるため、確定後に再計算する
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)

    mapRef.current = map
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // 初期化は一度きり。以降の変更は下の effect で反映する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外から明示的に指示されたときだけ移動する(moveend との往復を避ける)
  useEffect(() => {
    if (recenterKey === 0) return
    mapRef.current?.setView([center.lat, center.lng], zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  useEffect(() => {
    markerRef.current?.setLatLng([center.lat, center.lng])
  }, [center.lat, center.lng])

  return <div ref={elRef} className="map-canvas" />
}
