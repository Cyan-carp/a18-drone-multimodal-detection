import { Crosshair } from 'lucide-react'
import { classColor, classLabel } from '@/lib/colors'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/feedback'

export interface TableRow {
  cls: string
  conf: number
  box: [number, number, number, number]
  sources?: string[]
}

interface DetectionTableProps {
  rows: TableRow[]
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  maxHeight?: string
}

export function DetectionTable({ rows, hoveredIndex, onHover, maxHeight = '280px' }: DetectionTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Crosshair size={22} />}
        title="暂无检测结果"
        description="在左侧选择场景并点击「开始检测」，融合结果会按置信度从高到低列在这里，并与画布框联动。"
      />
    )
  }

  return (
    <div className="table-shell overflow-y-auto" style={{ maxHeight }}>
      <table>
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="w-10">#</th>
            <th>类别</th>
            <th className="w-36">置信度</th>
            <th>来源分支</th>
            <th className="text-right">框坐标</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const active = hoveredIndex === index
            return (
              <tr
                key={`${row.cls}-${row.box.join('-')}-${index}`}
                data-selected={active || undefined}
                onMouseEnter={() => onHover(index)}
                onMouseLeave={() => onHover(null)}
              >
                <td className="num text-text-muted">{String(index + 1).padStart(2, '0')}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: classColor(row.cls) }} />
                    <span className="text-text-primary">{classLabel(row.cls)}</span>
                    <span className="num text-[11.5px] text-text-muted">{row.cls}</span>
                  </span>
                </td>
                <td>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${row.conf * 100}%`, background: classColor(row.cls) }}
                      />
                    </span>
                    <span className="num w-10 text-right text-[12px] text-text-secondary">
                      {formatPercent(row.conf, 0)}
                    </span>
                  </span>
                </td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    {(row.sources ?? []).map((source) => (
                      <span
                        key={source}
                        className="num rounded-pill bg-ink-800 px-1.5 py-[2px] text-[11px] text-text-secondary"
                      >
                        {source}
                      </span>
                    ))}
                  </span>
                </td>
                <td className={cn('num text-right text-[11.5px] text-text-muted')}>{row.box.join(', ')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
