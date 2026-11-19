import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('panel', className)} {...props} />
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-[22px] py-5', className)} {...props} />
}

interface PanelHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PanelHeader({ title, subtitle, icon, actions, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-[22px] py-3.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-signal-cyan">{icon}</span> : null}
        <div className="min-w-0">
          <div className="section-title truncate">{title}</div>
          {subtitle ? <div className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}
