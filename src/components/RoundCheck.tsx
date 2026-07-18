export function RoundCheck({ done, onToggle, label }: { done: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      className={`check${done ? ' check--done' : ''}`}
      role="checkbox"
      aria-checked={done}
      aria-label={label ?? (done ? '未完了に戻す' : '完了にする')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      ✓
    </button>
  )
}
