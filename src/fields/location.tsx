import { Suspense, lazy, useRef, useState } from 'react'
import type { LocationValue } from '../types'
import {
  DEFAULT_ZOOM,
  FALLBACK_CENTER,
  currentPosition,
  hasCoords,
  mapAppUrl,
  reverseGeocode,
  searchPlaces,
  type GeoResult
} from '../lib/geo'
import type { FieldDef, FieldInputProps } from './types'

// leaflet を初期バンドルから外すための遅延読み込み。
// 「場所」項目を持つメモを開いたときに初めて取得される
const MapView = lazy(() => import('../components/MapView'))

function MapFallback({ tall }: { tall?: boolean }) {
  return <div className={`map-canvas map-canvas--loading${tall ? ' map-canvas--tall' : ''}`} />
}

// --- 地点を選ぶ全画面ピッカー ------------------------------------------------

function LocationPicker({
  value,
  tileUrl,
  attribution,
  onCancel,
  onDecide
}: {
  value: LocationValue
  tileUrl?: string
  attribution?: string
  onCancel: () => void
  onDecide: (next: LocationValue) => void
}) {
  const start = hasCoords(value) ? { lat: value.lat, lng: value.lng } : FALLBACK_CENTER
  const center = useRef({ ...start, zoom: value.zoom ?? DEFAULT_ZOOM })
  const [view, setView] = useState(start)
  const [zoom, setZoom] = useState(value.zoom ?? DEFAULT_ZOOM)
  const [recenterKey, setRecenterKey] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [name, setName] = useState(value.name ?? '')
  const [address, setAddress] = useState(value.address ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)

  const moveTo = (lat: number, lng: number, z = zoom) => {
    center.current = { lat, lng, zoom: z }
    setView({ lat, lng })
    setZoom(z)
    setRecenterKey((k) => k + 1)
  }

  const useCurrent = async () => {
    setError(null)
    setBusy('現在地を取得中…')
    try {
      const p = await currentPosition()
      moveTo(p.lat, p.lng, Math.max(zoom, DEFAULT_ZOOM))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Nominatim の規約により、入力中ではなく明示操作でのみ検索する
  const runSearch = async () => {
    if (!query.trim()) return
    setError(null)
    setBusy('検索中…')
    try {
      const found = await searchPlaces(query)
      setResults(found)
      if (found.length === 0) setError('見つかりませんでした')
    } catch {
      setError('検索できませんでした。通信状況を確認してください')
    } finally {
      setBusy(null)
    }
  }

  const pickResult = (r: GeoResult) => {
    moveTo(r.lat, r.lng, DEFAULT_ZOOM)
    if (!name.trim()) setName(r.name)
    setAddress(r.address)
    setResults(null)
    setQuery('')
  }

  const decide = async () => {
    const c = center.current
    let addr = address.trim()
    if (!addr) {
      setBusy('住所を取得中…')
      addr = (await reverseGeocode(c.lat, c.lng)) ?? ''
      setBusy(null)
    }
    onDecide({
      name: name.trim() || undefined,
      address: addr || undefined,
      lat: c.lat,
      lng: c.lng,
      zoom: c.zoom
    })
  }

  return (
    <div className="map-picker" role="dialog" aria-label="地点を選ぶ">
      <header className="modal-header">
        <button className="modal-cancel" onClick={onCancel}>
          キャンセル
        </button>
        <span className="modal-title">地点を選ぶ</span>
        <button className="modal-save" onClick={decide}>
          決定
        </button>
      </header>

      <div className="map-search">
        <input
          className="field-input"
          value={query}
          placeholder="店名や住所で検索…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runSearch()
            }
          }}
        />
        <button className="field-action" onClick={runSearch} disabled={!query.trim()}>
          検索
        </button>
      </div>

      <div className="map-stage">
        <Suspense fallback={<MapFallback tall />}>
          <MapView
            center={view}
            zoom={zoom}
            interactive
            tileUrl={tileUrl}
            attribution={attribution}
            recenterKey={recenterKey}
            onMoveEnd={(c) => {
              center.current = c
            }}
            onTileError={() => setTilesFailed(true)}
          />
        </Suspense>
        {/* ピンは画面中央に固定し、地図側を動かして合わせる */}
        <div className="map-crosshair" aria-hidden="true">
          <span className="map-pin" />
        </div>
        <button className="map-locate" aria-label="現在地へ" onClick={useCurrent}>
          ◎
        </button>
        {tilesFailed && (
          <div className="map-offline">
            地図を読み込めませんでした。オフラインでも住所と地点名は保存できます
          </div>
        )}
        {results && results.length > 0 && (
          <div className="map-results">
            {results.map((r) => (
              <button key={`${r.lat},${r.lng}`} onClick={() => pickResult(r)}>
                <b>{r.name}</b>
                <span>{r.address}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="map-meta">
        <input
          className="field-input"
          value={name}
          placeholder="地点名(例:代々木のカレー店)"
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field-input"
          value={address}
          placeholder="住所(空なら決定時に自動取得)"
          onChange={(e) => setAddress(e.target.value)}
        />
        {busy && <div className="field-hint">{busy}</div>}
        {error && <div className="field-error">{error}</div>}
      </div>
    </div>
  )
}

// --- フィールド本体 ----------------------------------------------------------

function LocationInput({ field, onChange }: FieldInputProps<'location'>) {
  const [picking, setPicking] = useState(false)
  const [tilesFailed, setTilesFailed] = useState(false)
  const v = field.value
  const url = mapAppUrl(v)

  return (
    <div className="field-stack">
      {hasCoords(v) ? (
        <button className="map-preview" onClick={() => setPicking(true)} aria-label="地点を変更">
          {tilesFailed ? (
            <div className="map-canvas map-canvas--offline">地図を読み込めませんでした</div>
          ) : (
            <Suspense fallback={<MapFallback />}>
              <MapView
                center={{ lat: v.lat, lng: v.lng }}
                zoom={v.zoom ?? DEFAULT_ZOOM}
                interactive={false}
                showMarker
                tileUrl={field.config.tileUrl}
                attribution={field.config.attribution}
                onTileError={() => setTilesFailed(true)}
              />
            </Suspense>
          )}
        </button>
      ) : (
        <div className="field-row">
          <button className="field-action" onClick={() => setPicking(true)}>
            🗺 地図から選ぶ
          </button>
        </div>
      )}

      {(v.name || v.address) && (
        <div className="location-meta">
          {v.name && <b>{v.name}</b>}
          {v.address && <span>{v.address}</span>}
        </div>
      )}

      <div className="field-row">
        {hasCoords(v) && (
          <button className="field-action" onClick={() => setPicking(true)}>
            変更
          </button>
        )}
        {url && (
          <a className="field-action" href={url} target="_blank" rel="noreferrer noopener">
            地図アプリで開く
          </a>
        )}
        {(hasCoords(v) || v.name || v.address) && (
          <button className="field-action field-action--quiet" onClick={() => onChange({})}>
            クリア
          </button>
        )}
      </div>

      {picking && (
        <LocationPicker
          value={v}
          tileUrl={field.config.tileUrl}
          attribution={field.config.attribution}
          onCancel={() => setPicking(false)}
          onDecide={(next) => {
            onChange(next)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

export const locationDef: FieldDef<'location'> = {
  kind: 'location',
  name: '場所',
  icon: '📍',
  hint: '地図で位置を選び、地点名・住所・座標を残す',
  tier: 1,
  createConfig: () => ({ defaultZoom: DEFAULT_ZOOM }),
  createValue: () => ({}),
  Input: LocationInput,
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row">
      <span>タイルURL</span>
      <input
        className="field-input"
        value={field.config.tileUrl ?? ''}
        placeholder="空なら OpenStreetMap"
        onChange={(e) => onChange({ ...field.config, tileUrl: e.target.value || undefined })}
      />
    </label>
  ),
  summarize: (f) => f.value.name?.trim() || f.value.address?.split(',')[0].trim() || '',
  searchText: (f) => `${f.value.name ?? ''} ${f.value.address ?? ''}`,
  isEmpty: (f) => !hasCoords(f.value) && !f.value.name && !f.value.address
}
