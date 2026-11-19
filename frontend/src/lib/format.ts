export function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatClock(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

export function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('zh-CN')
}

export function stageLabel(stage: string) {
  const map: Record<string, string> = {
    QUEUED: '排队中',
    RUNNING: '执行中',
    LOAD: '载入图像',
    RGB: 'RGB 分支',
    IR: '红外分支',
    DUAL: '双流分支',
    FUSE: 'WBF 融合',
    POST: '后处理',
    DONE: '完成',
    SUCCESS: '已完成',
    FAILED: '失败',
  }
  return map[stage] ?? stage
}
