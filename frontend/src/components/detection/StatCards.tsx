import { Crosshair, Gauge, Timer, TrendingUp } from 'lucide-react'
import { formatMs, formatPercent } from '@/lib/format'
import type { Metrics } from '@/lib/types'

interface StatCardsProps {
  count: number
  avgConfidence: number
  elapsedMs: number
  metrics: Metrics | null
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="panel px-[21px] py-[17px]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-secondary">{label}</span>
        <span className="text-signal-cyan">{icon}</span>
      </div>
      <div className="metric-value mt-2">{value}</div>
      {sub ? <div className="mt-1.5 text-[12px] text-text-muted">{sub}</div> : null}
    </div>
  )
}

export function StatCards({ count, avgConfidence, elapsedMs, metrics }: StatCardsProps) {
  const fps = elapsedMs > 0 ? Math.min(999, 1000 / elapsedMs) : 0
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat icon={<Crosshair size={15} />} label="融合目标数" value={String(count)} sub="WBF 后保留" />
      <Stat
        icon={<Gauge size={15} />}
        label="平均置信度"
        value={avgConfidence > 0 ? formatPercent(avgConfidence) : '—'}
        sub="按目标等权"
      />
      <Stat
        icon={<Timer size={15} />}
        label="端到端耗时"
        value={elapsedMs > 0 ? formatMs(elapsedMs) : '—'}
        sub={fps > 0 ? `≈ ${fps.toFixed(1)} FPS` : '尚未运行'}
      />
      <Stat
        icon={<TrendingUp size={15} />}
        label="精确率 / 召回率"
        value={metrics ? `${formatPercent(metrics.precision, 0)} / ${formatPercent(metrics.recall, 0)}` : '—'}
        sub={metrics ? `TP ${metrics.tp} · FP ${metrics.fp} · FN ${metrics.fn}` : '上传图像无真值'}
      />
    </div>
  )
}
