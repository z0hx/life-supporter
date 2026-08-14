import type { FieldDef, FieldInputProps } from './types'

// --- 数値 -------------------------------------------------------------------

export const numberDef: FieldDef<'number'> = {
  kind: 'number',
  name: '数値',
  icon: '🔢',
  hint: '予算・人数・所要時間など。単位を決められる',
  tier: 1,
  createConfig: () => ({}),
  createValue: () => null,
  Input: ({ field, onChange }) => (
    <div className="field-row">
      <input
        className="field-input field-input--number"
        type="number"
        inputMode="decimal"
        value={field.value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
      {field.config.unit && <span className="field-unit">{field.config.unit}</span>}
    </div>
  ),
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row">
      <span>単位</span>
      <input
        className="field-input field-input--narrow"
        value={field.config.unit ?? ''}
        placeholder="円 / 人 / 分"
        onChange={(e) => onChange({ ...field.config, unit: e.target.value })}
      />
    </label>
  ),
  summarize: (f) =>
    f.value == null ? '' : `${f.value.toLocaleString('ja-JP')}${f.config.unit ?? ''}`,
  searchText: (f) => (f.value == null ? '' : String(f.value)),
  isEmpty: (f) => f.value == null
}

// --- 日付 -------------------------------------------------------------------

export const dateDef: FieldDef<'date'> = {
  kind: 'date',
  name: '日付',
  icon: '📅',
  hint: '期限や行きたい日。時刻ありにも切り替えられる',
  tier: 1,
  createConfig: () => ({ withTime: false }),
  createValue: () => null,
  Input: ({ field, onChange }) => (
    <input
      className="field-input"
      type={field.config.withTime ? 'datetime-local' : 'date'}
      value={field.value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  ),
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row field-config-row--check">
      <input
        type="checkbox"
        checked={field.config.withTime}
        onChange={(e) => onChange({ ...field.config, withTime: e.target.checked })}
      />
      <span>時刻も入力する</span>
    </label>
  ),
  summarize: (f) => {
    if (!f.value) return ''
    const [d, t] = f.value.split('T')
    const [y, m, day] = d.split('-')
    const base = `${Number(m)}/${Number(day)}`
    const withYear = String(new Date().getFullYear()) === y ? base : `${y}/${base}`
    return t ? `${withYear} ${t}` : withYear
  },
  searchText: (f) => f.value ?? '',
  isEmpty: (f) => !f.value
}

// --- 評価 -------------------------------------------------------------------

function RatingInput({ field, onChange }: FieldInputProps<'rating'>) {
  const max = field.config.max
  const current = field.value ?? 0
  return (
    <div className="rating" role="radiogroup" aria-label="評価">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={`rating-star${n <= current ? ' rating-star--on' : ''}`}
          role="radio"
          aria-checked={n === current}
          aria-label={`${n}`}
          // 同じ星をもう一度押したら未評価に戻す
          onClick={() => onChange(n === field.value ? null : n)}
        >
          ★
        </button>
      ))}
      {field.value != null && (
        <button className="rating-clear" onClick={() => onChange(null)}>
          クリア
        </button>
      )}
    </div>
  )
}

export const ratingDef: FieldDef<'rating'> = {
  kind: 'rating',
  name: '評価',
  icon: '⭐️',
  hint: '行った店や読んだ本の感想を星で残す',
  tier: 1,
  createConfig: () => ({ max: 5 }),
  createValue: () => null,
  Input: RatingInput,
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row">
      <span>星の数</span>
      <input
        className="field-input field-input--narrow"
        type="number"
        inputMode="numeric"
        min={3}
        max={10}
        value={field.config.max}
        onChange={(e) => onChange({ ...field.config, max: Number(e.target.value) || 5 })}
      />
    </label>
  ),
  summarize: (f) => (f.value == null ? '' : '★'.repeat(f.value) + '☆'.repeat(f.config.max - f.value)),
  searchText: () => '',
  isEmpty: (f) => f.value == null
}

// --- はい / いいえ ----------------------------------------------------------

export const toggleDef: FieldDef<'toggle'> = {
  kind: 'toggle',
  name: 'はい / いいえ',
  icon: '🔘',
  hint: '予約済み・支払い済みのような単発のフラグ',
  tier: 1,
  createConfig: () => ({}),
  createValue: () => false,
  Input: ({ field, onChange }) => (
    <button
      className={`toggle${field.value ? ' toggle--on' : ''}`}
      role="switch"
      aria-checked={field.value}
      onClick={() => onChange(!field.value)}
    >
      <span className="toggle-knob" />
    </button>
  ),
  summarize: (f) => (f.value ? f.label : ''),
  searchText: (f) => (f.value ? f.label : ''),
  isEmpty: (f) => !f.value
}

// --- 見出し / 区切り --------------------------------------------------------

export const headingDef: FieldDef<'heading'> = {
  kind: 'heading',
  name: '見出し',
  icon: '➖',
  hint: '入力欄ではなく区切り。項目が多いテンプレートで読みやすくなる',
  tier: 2,
  createConfig: () => ({}),
  createValue: () => null,
  Input: () => null,
  summarize: () => '',
  searchText: () => '',
  isEmpty: () => true
}
