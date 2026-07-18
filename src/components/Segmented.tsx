export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fill,
  light
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  fill?: boolean
  light?: boolean
}) {
  return (
    <div
      className={`segmented${fill ? ' segmented--fill' : ''}${light ? ' segmented--light' : ''}`}
      role="group"
    >
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
