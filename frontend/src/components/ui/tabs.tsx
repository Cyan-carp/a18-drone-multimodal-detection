import { cn } from '@/lib/utils'

interface SegmentedProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

export function Segmented<T extends string>({ value, options, onChange, disabled, className }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex rounded-control border border-ink-700 bg-ink-800 p-[3px]', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12.5px] transition-colors',
              active
                ? 'bg-ink-850 text-text-strong shadow-pg'
                : 'text-text-secondary hover:bg-ink-850/60 hover:text-text-primary',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
