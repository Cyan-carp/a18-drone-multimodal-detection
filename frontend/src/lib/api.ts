import type {
  BatchJob,
  LogEntry,
  PageResult,
  RunParams,
  RunRecord,
  RunSummary,
  Scenario,
  ScenarioSummary,
  SystemInfo,
  UploadInfo,
} from './types'

const BASE = '/api'

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.message ?? `请求失败（HTTP ${response.status}）`
    throw new ApiError(message, body?.code ?? 'HTTP_ERROR', response.status)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value))
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  systemInfo: () => request<SystemInfo>('/system/info'),

  regenerateScenarios: () =>
    request<{ generated: number; elapsedMs: number }>('/system/regenerate-scenarios', { method: 'POST' }),

  scenarios: () => request<ScenarioSummary[]>('/scenarios'),

  scenario: (id: string) => request<Scenario>(`/scenarios/${id}`),

  uploadFiles: (rgb: File | null, ir: File | null) => {
    const form = new FormData()
    if (rgb) form.append('rgb', rgb)
    if (ir) form.append('ir', ir)
    return request<UploadInfo>('/uploads', { method: 'POST', body: form, headers: {} })
  },

  createRun: (payload: { sourceType: 'scenario' | 'upload'; sourceId: string; params: RunParams }) =>
    request<RunRecord>('/runs', { method: 'POST', body: JSON.stringify(payload) }),

  run: (id: string) => request<RunRecord>(`/runs/${id}`),

  runs: (params: { page?: number; size?: number; status?: string; keyword?: string; sourceType?: string }) =>
    request<PageResult<RunSummary>>(`/runs${query(params)}`),

  deleteRun: (id: string) => request<void>(`/runs/${id}`, { method: 'DELETE' }),

  deleteRuns: (ids: string[]) =>
    request<{ deleted: number }>('/runs/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  createBatch: (scenarioIds: string[], params: RunParams) =>
    request<BatchJob>('/batches', { method: 'POST', body: JSON.stringify({ scenarioIds, params }) }),

  batch: (id: string) => request<BatchJob>(`/batches/${id}`),

  batches: (params: { page?: number; size?: number }) =>
    request<PageResult<BatchJob>>(`/batches${query(params)}`),

  deleteBatch: (id: string) => request<void>(`/batches/${id}`, { method: 'DELETE' }),

  logs: (params: { limit?: number; level?: string; keyword?: string }) =>
    request<LogEntry[]>(`/logs${query(params)}`),

  exportUrl: (runId: string, format: 'json' | 'csv') =>
    `${BASE}/runs/${runId}/export?format=${format}`,

  allExportUrl: (format: 'json' | 'csv', filters: { status?: string; keyword?: string } = {}) =>
    `${BASE}/runs/export${query({ format, ...filters })}`,
}

export async function downloadFile(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new ApiError('导出失败', 'EXPORT_FAILED', response.status)
  }
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export interface StreamHandlers {
  onProgress?: (payload: { stage: string; percent: number; message: string; ts: string }) => void
  onLog?: (entry: LogEntry) => void
  onResult?: (run: RunRecord) => void
  onError?: (message: string) => void
}

/**
 * 订阅任务进度。EventSource 失败时自动降级为轮询，保证演示不因代理配置中断而卡死。
 */
export function streamRun(runId: string, handlers: StreamHandlers) {
  let closed = false
  let source: EventSource | null = null
  let pollTimer: number | undefined

  const startPolling = () => {
    if (pollTimer !== undefined || closed) return
    pollTimer = window.setInterval(() => {
      api
        .run(runId)
        .then((record) => {
          if (closed) return
          if (record.status === 'SUCCESS' || record.status === 'FAILED') {
            if (pollTimer !== undefined) window.clearInterval(pollTimer)
            pollTimer = undefined
            if (record.status === 'FAILED') {
              handlers.onError?.(record.error ?? '任务失败')
            } else {
              handlers.onResult?.(record)
            }
          }
        })
        .catch((error) => {
          console.error('[stream] polling failed', error)
        })
    }, 500)
  }

  const connect = () => {
    source = new EventSource(`/api/runs/${runId}/stream`)

    source.addEventListener('progress', (event) => {
      const payload = JSON.parse((event as MessageEvent).data)
      handlers.onProgress?.(payload)
    })
    source.addEventListener('log', (event) => {
      const entry = JSON.parse((event as MessageEvent).data) as LogEntry
      handlers.onLog?.(entry)
    })
    source.addEventListener('result', (event) => {
      const record = JSON.parse((event as MessageEvent).data) as RunRecord
      handlers.onResult?.(record)
      close()
    })
    source.addEventListener('error', () => {
      if (closed) return
      source?.close()
      startPolling()
    })
  }

  const close = () => {
    closed = true
    source?.close()
    if (pollTimer !== undefined) window.clearInterval(pollTimer)
  }

  connect()
  return close
}
