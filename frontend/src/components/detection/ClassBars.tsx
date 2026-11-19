import { CLASS_LABELS, classColor } from '@/lib/colors'

interface ClassBarsProps {
  detections: Array<{ cls: string }>
  groundTruth?: Array<{ cls: string }>
}

export function ClassBars({ detections, groundTruth }: ClassBarsProps) {
  const classes = Object.keys(CLASS_LABELS)
  const predicted: Record<string, number> = {}
  const truth: Record<string, number> = {}
  detections.forEach((item) => {
    predicted[item.cls] = (predicted[item.cls] ?? 0) + 1
  })
  groundTruth?.forEach((item) => {
    truth[item.cls] = (truth[item.cls] ?? 0) + 1
  })
  const max = Math.max(1, ...classes.map((cls) => Math.max(predicted[cls] ?? 0, truth[cls] ?? 0)))

  return (
    <div className="space-y-2">
      {classes.map((cls) => {
        const count = predicted[cls] ?? 0
        const gt = truth[cls]
        return (
          <div key={cls} className="flex items-center gap-2.5">
            <span className="w-14 shrink-0 text-[12px] text-text-secondary">{CLASS_LABELS[cls]}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
              {gt !== undefined ? (
                <span
                  className="absolute inset-y-0 left-0 rounded-full border border-dashed border-ink-600"
                  style={{ width: `${((gt ?? 0) / max) * 100}%` }}
                />
              ) : null}
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                style={{ width: `${(count / max) * 100}%`, background: classColor(cls) }}
              />
            </span>
            <span className="num w-11 shrink-0 text-right text-[12px] text-text-primary">
              {count}
              {gt !== undefined ? <span className="text-text-muted"> / {gt}</span> : null}
            </span>
          </div>
        )
      })}
      {groundTruth ? (
        <p className="pt-0.5 text-[12px] text-text-muted">实心为检测数量，虚线框为真值数量。</p>
      ) : null}
    </div>
  )
}
