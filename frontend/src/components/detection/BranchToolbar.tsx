import { Eye, EyeOff, Tags } from 'lucide-react'
import { Segmented } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { classColor } from '@/lib/colors'
import { cn } from '@/lib/utils'

export type ViewMode = 'fused' | 'rgb' | 'ir' | 'dual'

interface BranchToolbarProps {
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  showGroundTruth: boolean
  onToggleGroundTruth: () => void
  showLabels: boolean
  onToggleLabels: () => void
  counts: Record<string, number>
  groundTruthCount: number
}

export function BranchToolbar({
  view,
  onViewChange,
  showGroundTruth,
  onToggleGroundTruth,
  showLabels,
  onToggleLabels,
  counts,
  groundTruthCount,
}: BranchToolbarProps) {
  const options = [
    { value: 'fused' as ViewMode, label: `WBF 融合 ${counts.fused ?? 0}` },
    { value: 'rgb' as ViewMode, label: `RGB ${counts.rgb ?? 0}` },
    { value: 'ir' as ViewMode, label: `IR ${counts.ir ?? 0}` },
    { value: 'dual' as ViewMode, label: `双流 ${counts.dual ?? 0}` },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 px-[22px] py-2.5">
      <Segmented value={view} options={options} onChange={onViewChange} />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onToggleGroundTruth} aria-pressed={showGroundTruth}>
          {showGroundTruth ? <Eye size={14} /> : <EyeOff size={14} />}
          真值 {groundTruthCount}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggleLabels} aria-pressed={showLabels}>
          <Tags size={14} className={cn(showLabels && 'text-signal-cyan')} />
          {showLabels ? '标签开' : '标签关'}
        </Button>
      </div>
    </div>
  )
}

export function ClassLegend({ classes }: { classes: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {classes.map((cls) => (
        <span key={cls} className="inline-flex items-center gap-1.5 text-[11.5px] text-text-secondary">
          <span className="h-2 w-2 rounded-sm" style={{ background: classColor(cls) }} />
          {cls}
        </span>
      ))}
    </div>
  )
}
