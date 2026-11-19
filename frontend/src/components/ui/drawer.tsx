import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-3xl' }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="关闭详情"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgb(var(--pg-text-strong))]/25 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : '详情'}
        className={`relative flex h-full w-full ${width} animate-fade-up flex-col border-l border-ink-700 bg-ink-850 shadow-pg-lift`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-700 px-[22px] py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium text-text-strong">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-4">{children}</div>
        {footer ? <footer className="border-t border-ink-700 px-[22px] py-3">{footer}</footer> : null}
      </aside>
    </div>
  )
}
