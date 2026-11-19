import { cn } from '@/lib/utils'

export function Progress({
  value,
  className,
  tone = 'cyan',
}: {
  value: number
  className?: string
  tone?: 'cyan' | 'green' | 'amber'
}) {
  const tones = {
    cyan: 'bg-signal-cyan',
    green: 'bg-signal-green',
    amber: 'bg-signal-amber',
  }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-700', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 ease-out', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
