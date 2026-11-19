import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { Crosshair } from 'lucide-react'
import { classColor, withAlpha } from '@/lib/colors'
import type { SceneObject } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/feedback'

export interface RenderBox {
  cls: string
  conf: number
  box: [number, number, number, number]
  sources?: string[]
}

interface Size {
  width: number
  height: number
}

interface DualCanvasProps {
  rgbUrl: string | null
  irUrl: string | null
  boxes: RenderBox[]
  groundTruth: SceneObject[]
  showGroundTruth: boolean
  showLabels: boolean
  visible: boolean
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  size: Size
}

/**
 * 画布按容器实际像素绘制，坐标统一乘以显示比例，保证缩略图尺寸下标签依然可读。
 */
function paint(
  canvas: HTMLCanvasElement,
  boxes: RenderBox[],
  groundTruth: SceneObject[],
  showGroundTruth: boolean,
  showLabels: boolean,
  hoveredIndex: number | null,
  size: Size,
) {
  const context = canvas.getContext('2d')
  if (!context || size.width === 0) return
  const ratio = canvas.width / size.width
  const dpr = window.devicePixelRatio || 1
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.lineJoin = 'round'

  if (showGroundTruth) {
    context.setLineDash([5 * dpr, 3 * dpr])
    groundTruth.forEach((item, index) => {
      const [x1, y1, x2, y2] = item.box
      context.strokeStyle = 'rgba(104, 115, 138, 0.72)'
      context.lineWidth = 1.2 * dpr
      context.strokeRect(x1 * ratio, y1 * ratio, (x2 - x1) * ratio, (y2 - y1) * ratio)
      if (showLabels) {
        context.font = `${9.5 * dpr}px "Microsoft YaHei UI", sans-serif`
        context.fillStyle = 'rgba(104, 115, 138, 0.85)'
        context.fillText(`GT${index + 1}`, x1 * ratio + 2 * dpr, y1 * ratio - 3 * dpr)
      }
    })
    context.setLineDash([])
  }

  boxes.forEach((item, index) => {
    const [x1, y1, x2, y2] = item.box
    const color = classColor(item.cls)
    const active = hoveredIndex === index
    const left = x1 * ratio
    const top = y1 * ratio
    const width = (x2 - x1) * ratio
    const height = (y2 - y1) * ratio

    context.fillStyle = withAlpha(color, active ? 0.2 : 0.08)
    context.fillRect(left, top, width, height)
    context.strokeStyle = color
    context.lineWidth = (active ? 2.4 : 1.4) * dpr
    context.strokeRect(left, top, width, height)

    if (showLabels) {
      const label = `${item.cls} ${(item.conf * 100).toFixed(0)}`
      const fontSize = 9.5 * dpr
      context.font = `600 ${fontSize}px "Segoe UI", "Microsoft YaHei UI", sans-serif`
      const textWidth = context.measureText(label).width + 6 * dpr
      const labelY = Math.max(0, top - fontSize - 2 * dpr)
      context.fillStyle = withAlpha(color, 0.92)
      context.fillRect(left, labelY, textWidth, fontSize + 3 * dpr)
      context.fillStyle = '#FFFFFF'
      context.fillText(label, left + 3 * dpr, labelY + fontSize)
    }
  })
}

function ModalityPanel({
  title,
  hint,
  url,
  boxes,
  groundTruth,
  showGroundTruth,
  showLabels,
  hoveredIndex,
  onHover,
  size,
}: {
  title: string
  hint: string
  url: string | null
  boxes: RenderBox[]
  groundTruth: SceneObject[]
  showGroundTruth: boolean
  showLabels: boolean
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  size: Size
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper || size.width === 0) return
    const displayWidth = wrapper.clientWidth
    if (displayWidth === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(displayWidth * dpr)
    canvas.height = Math.round(displayWidth * (size.height / size.width) * dpr)
    paint(canvas, boxes, groundTruth, showGroundTruth, showLabels, hoveredIndex, size)
  }, [boxes, groundTruth, hoveredIndex, showGroundTruth, showLabels, size])

  useEffect(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = window.requestAnimationFrame(repaint)
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [repaint])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => repaint())
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [repaint])

  const handleMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * size.width
      const y = ((event.clientY - rect.top) / rect.height) * size.height
      let found: number | null = null
      for (let index = boxes.length - 1; index >= 0; index -= 1) {
        const [x1, y1, x2, y2] = boxes[index].box
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
          found = index
          break
        }
      }
      onHover(found)
    },
    [boxes, onHover, size.height, size.width],
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">
          <Crosshair size={12} className="text-signal-cyan" />
          {title}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{hint}</span>
      </div>
      <div
        ref={wrapperRef}
        className="relative overflow-hidden rounded-status border border-ink-700 bg-ink-800"
        onMouseMove={handleMove}
        onMouseLeave={() => onHover(null)}
      >
        {url ? (
          <img src={url} alt={title} className="block h-auto w-full select-none" draggable={false} />
        ) : (
          <div className="flex aspect-square items-center justify-center text-[11px] text-text-muted">无图像</div>
        )}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <span className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 border-l border-t border-signal-cyan/50" />
        <span className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 border-r border-t border-signal-cyan/50" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-3 w-3 border-b border-l border-signal-cyan/50" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-3 w-3 border-b border-r border-signal-cyan/50" />
      </div>
    </div>
  )
}

export function DualCanvas(props: DualCanvasProps) {
  const { rgbUrl, irUrl, size } = props

  if (!rgbUrl && !irUrl) {
    return (
      <EmptyState
        icon={<Crosshair size={22} />}
        title="尚未选择检测输入"
        description="在左侧选择一组内置样例场景，或切换到本地上传，导入成对的可见光与红外图像。"
      />
    )
  }

  const showRgb = props.visible && Boolean(rgbUrl)
  const showIr = Boolean(irUrl)
  const single = showRgb !== showIr

  return (
    <div className={cn('flex gap-2', single && 'justify-center')}>
      {showRgb ? (
        <div className={cn('flex min-w-0', single ? 'w-full max-w-2xl' : 'flex-1')}>
          <ModalityPanel
            title="可见光 RGB"
            hint="VIS"
            url={rgbUrl}
            boxes={props.boxes}
            groundTruth={props.groundTruth}
            showGroundTruth={props.showGroundTruth}
            showLabels={props.showLabels}
            hoveredIndex={props.hoveredIndex}
            onHover={props.onHover}
            size={size}
          />
        </div>
      ) : null}
      {showIr ? (
        <div className={cn('flex min-w-0', single ? 'w-full max-w-2xl' : 'flex-1')}>
          <ModalityPanel
            title="红外 IR"
            hint="THERMAL"
            url={irUrl}
            boxes={props.boxes}
            groundTruth={props.groundTruth}
            showGroundTruth={props.showGroundTruth}
            showLabels={props.showLabels}
            hoveredIndex={props.hoveredIndex}
            onHover={props.onHover}
            size={size}
          />
        </div>
      ) : null}
    </div>
  )
}
