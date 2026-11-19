import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'cyan' | 'green' | 'amber' | 'red' | 'blue' | 'violet'

const TONES: Record<Tone, string> = {
  neutral: 'border-ink-600 bg-ink-800 text-text-secondary',
  cyan: 'border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan',
  green: 'border-signal-green/30 bg-signal-green/10 text-signal-green',
  amber: 'border-signal-amber/35 bg-signal-amber/10 text-signal-amber',
  red: 'border-signal-red/30 bg-signal-red/10 text-signal-red',
  blue: 'border-signal-blue/30 bg-signal-blue/10 text-signal-blue',
  violet: 'border-signal-violet/30 bg-signal-violet/10 text-signal-violet',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2 py-[3px] text-[11.5px] leading-none',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}
