import type { FieldKind, Label, Template } from '../types'
import { createTemplateField } from '../fields'
import { uid } from './format'

export const DEFAULT_LABELS: Label[] = [
  { id: 'shopping', name: '買い物', emoji: '🛒', sortOrder: 0 },
  { id: 'gourmet', name: 'グルメ', emoji: '🍜', sortOrder: 1 },
  { id: 'outing', name: 'おでかけ', emoji: '🗺', sortOrder: 2 }
]

type FieldSpec = [FieldKind, string, Record<string, unknown>?]

function template(
  name: string,
  emoji: string,
  description: string,
  specs: FieldSpec[],
  defaultLabels: string[],
  sortOrder: number
): Template {
  const now = Date.now()
  return {
    id: uid(),
    name,
    emoji,
    description,
    fields: specs.map(([kind, label, config]) => {
      const f = createTemplateField(kind, label)
      return config ? { ...f, config: { ...f.config, ...config } } : f
    }) as Template['fields'],
    defaultLabels,
    builtin: true,
    createdAt: now,
    updatedAt: now,
    sortOrder
  }
}

// 初回起動時に投入する組み込みテンプレート。以降はユーザーが自由に編集・削除できる
export function buildDefaultTemplates(): Template[] {
  return [
    template(
      '買い物リスト',
      '🛒',
      '買うものをチェックしながら回る',
      [
        ['checklist', '買うもの'],
        ['text', '店', { placeholder: 'スーパー・ドラッグストアなど' }],
        ['number', '予算', { unit: '円' }]
      ],
      ['shopping'],
      0
    ),
    template(
      '行きたい店',
      '🍜',
      'TVやSNSで見た店を残しておく',
      [
        ['text', 'ジャンル', { placeholder: 'ラーメン・カレーなど' }],
        ['location', '場所'],
        ['url', '参考リンク'],
        ['date', '行きたい日'],
        ['rating', '評価'],
        ['longtext', 'メモ', { placeholder: '営業時間、混む時間帯など' }]
      ],
      ['gourmet'],
      1
    ),
    template(
      '行きたい場所',
      '🗺',
      '観光地や気になるスポット',
      [
        ['location', '場所'],
        ['url', '参考リンク'],
        ['longtext', 'メモ']
      ],
      ['outing'],
      2
    ),
    template(
      'シンプルメモ',
      '📝',
      '思いついたことをそのまま',
      [
        ['longtext', 'メモ'],
        ['url', 'リンク']
      ],
      [],
      3
    )
  ]
}
