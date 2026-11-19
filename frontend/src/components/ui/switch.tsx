import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  id?: string
}

export function Switch({ checked, onCheckedChange, disabled, label, id }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--pg-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--pg-surface))]',
        checked ? 'border-signal-cyan bg-signal-cyan' : 'border-ink-600 bg-ink-800',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-150',
          checked ? 'left-[18px]' : 'left-[3px]',
        )}
      />
    </button>
  )
}
