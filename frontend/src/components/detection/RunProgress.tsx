import { Check, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { stageLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const STAGES = ['LOAD', 'RGB', 'IR', 'DUAL', 'FUSE', 'POST', 'DONE'] as const

interface RunProgressProps {
  stage: string | null
  percent: number
  message: string
  running: boolean
  elapsedMs?: number
  branches: Record<string, boolean>
}

export function RunProgress({ stage, percent, message, running, elapsedMs, branches }: RunProgressProps) {
  const activeIndex = stage ? STAGES.indexOf(stage as (typeof STAGES)[number]) : -1
  const skipped = (key: string) =>
    key !== 'LOAD' && key !== 'FUSE' && key !== 'POST' && key !== 'DONE' && !branches[key]

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="flex items-center gap-1.5 text-text-secondary">
          {running ? <Loader2 size={13} className="animate-spin text-signal-cyan" /> : null}
          {running ? stageLabel(stage ?? 'QUEUED') : stage === 'DONE' ? '检测完成' : '待开始'}
        </span>
        <span className="num text-signal-cyan">{Math.round(percent)}%</span>
      </div>
      <Progress value={percent} tone={percent >= 100 ? 'green' : 'cyan'} />
      <div className="flex flex-wrap items-center gap-1">
        {STAGES.map((item, index) => {
          const done = activeIndex > index || percent >= 100
          const active = activeIndex === index && running
          const skip = skipped(item)
          return (
            <span
              key={item}
              className={cn(
                'inline-flex items-center gap-1 rounded-pill border px-1.5 py-[2px] text-[11px]',
                done && !skip
                  ? 'border-signal-green/30 bg-signal-green/10 text-signal-green'
                  : active
                    ? 'border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan'
                    : 'border-ink-700 text-text-muted',
                skip && 'opacity-45',
              )}
            >
              {done && !skip ? <Check size={10} /> : null}
              {stageLabel(item).replace(' 分支', '')}
            </span>
          )
        })}
      </div>
      <p className="min-h-[18px] text-[12px] leading-relaxed text-text-secondary">
        {message || (running ? '正在建立推理链路…' : '参数变更不会触发重跑，点击开始检测执行。')}
        {elapsedMs ? <span className="num ml-1 text-text-muted">· {elapsedMs} ms</span> : null}
      </p>
    </div>
  )
}
