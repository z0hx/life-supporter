import type { ReactNode } from 'react'

export interface DialogAction {
  label: string
  style?: 'primary' | 'dark' | 'ghost' | 'danger'
  onClick: () => void
}

export function Dialog({
  title,
  message,
  actions,
  children,
  onClose
}: {
  title: string
  message?: string
  actions: DialogAction[]
  children?: ReactNode
  onClose?: () => void
}) {
  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="dialog" role="dialog" aria-label={title}>
        <div className="dialog-title">{title}</div>
        {message && <div className="dialog-message">{message}</div>}
        {children}
        <div className="dialog-actions">
          {actions.map((a) => (
            <button
              key={a.label}
              className={`dialog-btn dialog-btn--${a.style ?? 'ghost'}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
