// 数据可视化色板：以 PersonalGate 主蓝为基准，其余四类取同饱和度的可区分色相。
// 这些颜色只用于数据标识（检测框、图例），不承担状态语义，状态仍用 success/warning/danger。
export const CLASS_COLORS: Record<string, string> = {
  car: '#4864ff',
  truck: '#12a150',
  bus: '#d97706',
  van: '#7c5cff',
  freight_car: '#dc2626',
}

export const CLASS_LABELS: Record<string, string> = {
  car: '轿车',
  truck: '卡车',
  bus: '客车',
  van: '厢式车',
  freight_car: '货车',
}

export const BRANCH_COLORS: Record<string, string> = {
  rgb: '#4864ff',
  ir: '#12a150',
  dual: '#7c5cff',
  fused: '#444f66',
}

export const WEATHER_TONES: Record<string, string> = {
  晴天: 'text-signal-amber border-signal-amber/35 bg-signal-amber/10',
  阴天: 'text-text-secondary border-ink-600 bg-ink-800',
  夜间: 'text-signal-blue border-signal-blue/35 bg-signal-blue/10',
}

export function classColor(cls: string) {
  return CLASS_COLORS[cls] ?? '#dc2626'
}

export function classLabel(cls: string) {
  return CLASS_LABELS[cls] ?? cls
}

export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
