import type { Template } from '../types'
import { useStore } from '../store'
import { fieldMeta } from '../fields'

export function TemplatePicker({
  onPick,
  onClose,
  onManage
}: {
  onPick: (t: Template) => void
  onClose: () => void
  onManage: () => void
}) {
  const { templates } = useStore()

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="テンプレートを選ぶ"
      >
        <div className="sheet-title">どのテンプレートで作る?</div>
        <div className="sheet-list">
          {templates.map((t) => (
            <button key={t.id} onClick={() => onPick(t)}>
              <span className="sheet-icon">{t.emoji ?? '📝'}</span>
              <span className="sheet-text">
                <b>{t.name}</b>
                <span>
                  {t.description ||
                    t.fields.map((f) => fieldMeta(f.kind).name).slice(0, 4).join('・') ||
                    '項目なし'}
                </span>
              </span>
            </button>
          ))}
          {templates.length === 0 && (
            <div className="field-hint">テンプレートがありません。まず1つ作りましょう</div>
          )}
        </div>
        <button className="sheet-footer-btn" onClick={onManage}>
          テンプレートを作る・編集する
        </button>
      </div>
    </div>
  )
}
