import { formatPercent } from '@/lib/format'
import type { Metrics } from '@/lib/types'

export function MetricCompare({ metrics, hasRun }: { metrics: Metrics | null; hasRun?: boolean }) {
  if (!metrics) {
    return (
      <p className="rounded-status border border-dashed border-ink-600 px-3 py-2.5 text-[12px] leading-relaxed text-text-secondary">
        {hasRun
          ? '上传图像没有真值标注，无法计算精确率与召回率。切换到内置样例场景可看到与真值的逐帧比对。'
          : '执行一次检测后，这里会给出与真值逐类匹配的精确率、召回率与 TP/FP/FN 分解。'}
      </p>
    )
  }

  const bars = [
    { label: 'Precision', value: metrics.precision, tone: 'bg-signal-cyan' },
    { label: 'Recall', value: metrics.recall, tone: 'bg-signal-green' },
  ]

  return (
    <div className="space-y-2.5">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-text-secondary">{bar.label}</span>
            <span className="num text-text-primary">{formatPercent(bar.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className={`h-full rounded-full ${bar.tone} transition-[width] duration-500`}
              style={{ width: `${Math.min(100, bar.value * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2 pt-0.5">
        {[
          { label: 'TP', value: metrics.tp, tone: 'text-signal-green' },
          { label: 'FP', value: metrics.fp, tone: 'text-signal-amber' },
          { label: 'FN', value: metrics.fn, tone: 'text-signal-red' },
        ].map((item) => (
          <div key={item.label} className="rounded-control border border-ink-700 bg-ink-800/70 px-2 py-1.5 text-center">
            <div className="text-[11px] text-text-muted">{item.label}</div>
            <div className={`num text-[14px] ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
