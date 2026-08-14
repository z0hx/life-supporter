import type { ReactElement } from 'react'
import type {
  FieldConfigMap,
  FieldKind,
  FieldValueMap,
  MemoFieldOf,
  TemplateFieldOf
} from '../types'

export interface FieldInputProps<K extends FieldKind> {
  field: MemoFieldOf<K>
  onChange: (value: FieldValueMap[K]) => void
}

export interface FieldConfigProps<K extends FieldKind> {
  field: TemplateFieldOf<K>
  onChange: (config: FieldConfigMap[K]) => void
}

// 種別ごとの振る舞いを1箇所に集約する。画面側は FIELD_DEFS を引くだけで、
// 種別が増えても画面のコードは変わらない
export interface FieldDef<K extends FieldKind> {
  kind: K
  name: string
  icon: string
  hint: string
  tier: 1 | 2
  createConfig: () => FieldConfigMap[K]
  createValue: (config: FieldConfigMap[K]) => FieldValueMap[K]
  /** メモ編集画面での入力UI */
  Input: (props: FieldInputProps<K>) => ReactElement | null
  /** テンプレート編集画面での設定UI(設定を持たない種別は省略) */
  ConfigInput?: (props: FieldConfigProps<K>) => ReactElement | null
  /** 一覧行に出す短い要約。空文字なら出さない */
  summarize: (field: MemoFieldOf<K>) => string
  /** 検索対象の文字列(要約より詳しくてよい) */
  searchText: (field: MemoFieldOf<K>) => string
  isEmpty: (field: MemoFieldOf<K>) => boolean
  /**
   * メモの値をテンプレートの初期値として持ち帰るときの整形。
   * 「その回だけの状態」(チェック済みなど)を落とすために使う
   */
  normalizeDefault?: (value: FieldValueMap[K]) => FieldValueMap[K]
}
