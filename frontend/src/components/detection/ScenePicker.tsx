import { CloudRain, Moon, ScanLine, Sun } from 'lucide-react'
import type { ScenarioSummary } from '@/lib/types'
import { WEATHER_TONES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/feedback'

const WEATHER_ICON: Record<string, typeof Sun> = {
  晴天: Sun,
  阴天: CloudRain,
  夜间: Moon,
}

interface ScenePickerProps {
  scenes: ScenarioSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
  disabled?: boolean
}

export function ScenePicker({ scenes, selectedId, onSelect, loading, disabled }: ScenePickerProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[86px] w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid max-h-[312px] grid-cols-2 gap-2.5 overflow-y-auto pr-1">
      {scenes.map((scene) => {
        const active = scene.id === selectedId
        const Icon = WEATHER_ICON[scene.weather] ?? ScanLine
        return (
          <button
            key={scene.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onSelect(scene.id)}
            className={cn(
              'group overflow-hidden rounded-status border text-left transition-colors',
              active
                ? 'border-signal-cyan bg-ink-850 shadow-pg'
                : 'border-ink-700 bg-ink-850 hover:border-signal-cyan/45',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            )}
          >
            <span className="relative block">
              <img
                src={scene.rgbUrl}
                alt={scene.name}
                loading="lazy"
                className="h-[56px] w-full object-cover"
              />
              <span
                className={cn(
                  'absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-pill border px-1.5 py-[1px] text-[10.5px]',
                  WEATHER_TONES[scene.weather] ?? 'border-ink-600 bg-ink-800 text-text-secondary',
                )}
              >
                <Icon size={10} />
                {scene.weather}
              </span>
            </span>
            <span className="block px-2 py-1.5">
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-[12.5px] text-text-primary">{scene.name}</span>
                <span className="num shrink-0 text-[11px] text-text-muted">{scene.objectCount}</span>
              </span>
              <span className="num mt-0.5 block text-[10.5px] text-text-muted">{scene.id}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
