import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-control bg-ink-800', className)} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-status border border-dashed border-ink-600 px-4 py-9 text-center',
        className,
      )}
    >
      {icon ? <div className="text-text-muted">{icon}</div> : null}
      <p className="text-[16px] font-medium text-text-primary">{title}</p>
      {description ? (
        <p className="max-w-sm text-[12.5px] leading-relaxed text-text-secondary">{description}</p>
      ) : null}
      {action}
    </div>
  )
}

export function SectionHint({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-relaxed text-text-muted">{children}</p>
}
