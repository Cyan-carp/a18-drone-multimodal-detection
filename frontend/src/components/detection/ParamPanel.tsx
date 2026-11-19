import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/tabs'
import type { BranchKey, RunParams } from '@/lib/types'

interface ParamPanelProps {
  params: RunParams
  onChange: (params: RunParams) => void
  onRun: () => void
  onReset: () => void
  running: boolean
  disabled: boolean
}

const BRANCH_META: Array<{ key: BranchKey; label: string; weight: string; hint: string }> = [
  { key: 'rgb', label: 'RGB 分支', weight: '1.70', hint: '可见光 YOLO26' },
  { key: 'ir', label: '红外分支', weight: '1.95', hint: '红外 YOLO26' },
  { key: 'dual', label: '双流分支', weight: '3.15', hint: 'dual_l / 6_0 / l_50' },
]

export function ParamPanel({ params, onChange, onRun, onReset, running, disabled }: ParamPanelProps) {
  const locked = disabled || running

  return (
    <div className="space-y-4">
      <Slider
        label="置信度阈值 conf"
        value={params.conf}
        min={0.05}
        max={0.6}
        step={0.01}
        display={params.conf.toFixed(2)}
        onChange={(value) => onChange({ ...params, conf: value })}
        disabled={locked}
        hint="融合后低于该置信度的目标会被丢弃"
      />
      <Slider
        label="融合 IoU 阈值"
        value={params.iou}
        min={0.3}
        max={0.9}
        step={0.01}
        display={params.iou.toFixed(2)}
        onChange={(value) => onChange({ ...params, iou: value })}
        disabled={locked}
        hint="WBF 聚簇阈值，越大越不容易合并同一目标"
      />

      <div className="space-y-1.5">
        <span className="text-[13px] text-text-primary">输入尺寸 imgsz</span>
        <Segmented
          value={String(params.imgsz)}
          options={[
            { value: '640', label: '640' },
            { value: '1024', label: '1024' },
          ]}
          onChange={(value) => onChange({ ...params, imgsz: Number(value) })}
          disabled={locked}
          className="w-full"
        />
      </div>

      <div className="space-y-2.5 rounded-status border border-ink-700 bg-ink-800/60 p-3">
        <div className="text-[12px] text-text-secondary">分支开关与 WBF 权重</div>
        {BRANCH_META.map((branch) => (
          <div key={branch.key} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] text-text-primary">{branch.label}</span>
                <span className="num rounded-pill bg-ink-850 px-1.5 text-[10.5px] text-signal-cyan">
                  {branch.weight}
                </span>
              </div>
              <p className="truncate text-[11px] text-text-muted">{branch.hint}</p>
            </div>
            <Switch
              checked={params.branches[branch.key]}
              onCheckedChange={(checked) =>
                onChange({ ...params, branches: { ...params.branches, [branch.key]: checked } })
              }
              disabled={locked}
              label={branch.label}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Button variant="solid" size="lg" className="w-full" onClick={onRun} disabled={locked}>
          <Play size={15} />
          {running ? '检测进行中…' : '开始检测'}
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onReset} disabled={running}>
          <RotateCcw size={13} />
          恢复默认参数
        </Button>
      </div>
    </div>
  )
}
