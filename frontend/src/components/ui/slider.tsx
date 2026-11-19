import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
  label: string
  display?: string
  hint?: string
}

export function Slider({ value, min, max, step, onChange, disabled, label, display, hint }: SliderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] text-text-primary" htmlFor={`slider-${label}`}>
          {label}
        </label>
        <span className="num text-[13px] text-signal-cyan">{display ?? value}</span>
      </div>
      <input
        id={`slider-${label}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-signal-cyan',
          'disabled:cursor-not-allowed disabled:opacity-45',
          '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white',
          '[&::-webkit-slider-thumb]:bg-signal-cyan [&::-webkit-slider-thumb]:shadow-sm',
        )}
      />
      {hint ? <p className="text-[12px] leading-relaxed text-text-muted">{hint}</p> : null}
    </div>
  )
}
