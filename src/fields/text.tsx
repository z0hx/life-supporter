import type { FieldDef } from './types'

export const textDef: FieldDef<'text'> = {
  kind: 'text',
  name: 'テキスト',
  icon: '✏️',
  hint: '1行の短い入力。ジャンル、最寄り駅、担当者名など',
  tier: 1,
  createConfig: () => ({}),
  createValue: () => '',
  Input: ({ field, onChange }) => (
    <input
      className="field-input"
      value={field.value}
      placeholder={field.config.placeholder ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  ConfigInput: ({ field, onChange }) => (
    <label className="field-config-row">
      <span>プレースホルダー</span>
      <input
        className="field-input"
        value={field.config.placeholder ?? ''}
        placeholder="入力例を書いておく"
        onChange={(e) => onChange({ ...field.config, placeholder: e.target.value })}
      />
    </label>
  ),
  summarize: (f) => f.value.trim(),
  searchText: (f) => f.value,
  isEmpty: (f) => !f.value.trim()
}

export const longtextDef: FieldDef<'longtext'> = {
  kind: 'longtext',
  name: 'メモ(複数行)',
  icon: '📄',
  hint: '自由記述。感想や補足を書き留める',
  tier: 1,
  createConfig: () => ({}),
  createValue: () => '',
  Input: ({ field, onChange }) => (
    <textarea
      className="field-textarea"
      rows={field.config.rows ?? 4}
      value={field.value}
      placeholder={field.config.placeholder ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  ConfigInput: ({ field, onChange }) => (
    <>
      <label className="field-config-row">
        <span>プレースホルダー</span>
        <input
          className="field-input"
          value={field.config.placeholder ?? ''}
          onChange={(e) => onChange({ ...field.config, placeholder: e.target.value })}
        />
      </label>
      <label className="field-config-row">
        <span>行数</span>
        <input
          className="field-input field-input--narrow"
          type="number"
          inputMode="numeric"
          min={2}
          max={12}
          value={field.config.rows ?? 4}
          onChange={(e) => onChange({ ...field.config, rows: Number(e.target.value) || 4 })}
        />
      </label>
    </>
  ),
  // 一覧では1行に潰す
  summarize: (f) => f.value.trim().split('\n')[0] ?? '',
  searchText: (f) => f.value,
  isEmpty: (f) => !f.value.trim()
}

export const phoneDef: FieldDef<'phone'> = {
  kind: 'phone',
  name: '電話番号',
  icon: '📞',
  hint: 'タップでそのまま発信できる',
  tier: 2,
  createConfig: () => ({}),
  createValue: () => '',
  Input: ({ field, onChange }) => (
    <div className="field-row">
      <input
        className="field-input"
        type="tel"
        inputMode="tel"
        value={field.value}
        placeholder="03-1234-5678"
        onChange={(e) => onChange(e.target.value)}
      />
      {field.value.trim() && (
        <a className="field-action" href={`tel:${field.value.replace(/[^\d+]/g, '')}`}>
          発信
        </a>
      )}
    </div>
  ),
  summarize: (f) => f.value.trim(),
  searchText: (f) => f.value,
  isEmpty: (f) => !f.value.trim()
}
