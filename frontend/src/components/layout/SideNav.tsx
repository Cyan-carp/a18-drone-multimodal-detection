import { NavLink } from 'react-router-dom'
import { ListChecks, Lock, Radar, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/', label: '检测工作台', short: '工作台', icon: Radar },
  { to: '/tasks', label: '任务中心', short: '任务', icon: ListChecks },
  { to: '/logs', label: '系统日志', short: '日志', icon: Terminal },
]

export function SideNav() {
  return (
    <nav className="fixed left-0 top-0 z-40 flex h-full w-[92px] flex-col items-center border-r border-ink-700 bg-ink-900 pb-[17px] pt-[23px]">
      <div className="mb-6 flex flex-col items-center gap-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-control bg-signal-cyan text-[12px] font-semibold text-white">
          A18
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'flex h-[62px] w-[62px] flex-col items-center justify-center gap-1 rounded-nav border transition-colors',
                  isActive
                    ? 'border-ink-700 bg-ink-850 text-signal-cyan shadow-pg'
                    : 'border-transparent text-text-secondary hover:bg-ink-850/70 hover:text-text-primary',
                )
              }
            >
              <Icon size={24} strokeWidth={1.6} />
              <span className="text-[11px] leading-none">{item.short}</span>
            </NavLink>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-1 text-text-muted" title="本地演示环境">
        <Lock size={14} strokeWidth={1.6} />
        <span className="text-[10px] leading-none">v1.0</span>
      </div>
    </nav>
  )
}
