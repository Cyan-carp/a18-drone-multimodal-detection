import { useEffect, useState } from 'react'
import { Activity, Cpu, Gauge, Moon, Sun } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatClock } from '@/lib/format'
import type { SystemInfo } from '@/lib/types'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface TopBarProps {
  info: SystemInfo | null
  online: boolean
}

export function TopBar({ info, online }: TopBarProps) {
  const [now, setNow] = useState(() => new Date())
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-ink-700 bg-ink-950/92 px-6 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-[15px] font-semibold text-text-strong">
          无人机视角多模态小目标检测
        </h1>
        <Badge tone="cyan">模拟模式</Badge>
        <span className="hidden items-center gap-1.5 text-[12px] text-text-muted lg:flex">
          VEDAI · 5 类目标 · WBF 三支路
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <span className="hidden items-center gap-1.5 text-[12px] text-text-secondary md:flex">
          <Gauge size={14} className="text-signal-cyan" />
          <span className="num text-text-primary">{info?.scenarioCount ?? '—'}</span> 组场景
        </span>

        <span className="hidden items-center gap-1.5 text-[12px] text-text-secondary xl:flex">
          <Cpu size={14} />
          JDK <span className="num text-text-primary">{info?.jdk ?? '—'}</span>
        </span>

        <span className="flex items-center gap-1.5 text-[12px]">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              online ? 'bg-signal-green' : 'bg-signal-red animate-pulse-soft',
            )}
          />
          <span className={online ? 'text-text-secondary' : 'text-signal-red'}>
            {online ? '已连接' : '未连接'}
          </span>
        </span>

        <span className="num hidden items-center gap-1.5 text-[12px] text-text-secondary sm:flex">
          <Activity size={14} className="text-text-muted" />
          {formatClock(now)}
        </span>

        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-ink-700 text-text-secondary transition-colors hover:border-ink-600 hover:text-signal-cyan"
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={1.7} /> : <Moon size={18} strokeWidth={1.7} />}
        </button>
      </div>
    </header>
  )
}
