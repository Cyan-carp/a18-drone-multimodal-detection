import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, PauseCircle, PlayCircle, Terminal } from 'lucide-react'
import { api } from '@/lib/api'
import type { LogEntry, SystemInfo } from '@/lib/types'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { cn } from '@/lib/utils'

const LEVEL_TONE: Record<string, string> = {
  DEBUG: 'text-text-muted',
  INFO: 'text-signal-cyan',
  WARN: 'text-signal-amber',
  ERROR: 'text-signal-red',
}

const LEVELS = ['', 'INFO', 'WARN', 'ERROR', 'DEBUG']

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export default function LogsPage() {
  const { info } = useSystemInfo()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [level, setLevel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [pending, setPending] = useState(0)
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    api
      .logs({ limit: 200 })
      .then((list) => setEntries(list))
      .catch((error) => console.error('[logs] initial fetch failed', error))
  }, [])

  useEffect(() => {
    const source = new EventSource('/api/logs/stream')
    source.onopen = () => setConnected(true)
    source.addEventListener('log', (event) => {
      const entry = JSON.parse((event as MessageEvent).data) as LogEntry
      setEntries((current) => [...current.slice(-499), entry])
      if (pausedRef.current === false) {
        window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'end' }))
      } else {
        setPending((count) => count + 1)
      }
    })
    source.onerror = () => {
      setConnected(false)
      console.error('[logs] stream error, browser will retry')
    }
    return () => source.close()
  }, [])

  useEffect(() => {
    if (!paused) {
      setPending(0)
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [paused])

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    return entries.filter((entry) => {
      if (level && entry.level !== level) return false
      if (kw && !entry.message.includes(kw) && !entry.scope.includes(kw)) return false
      return true
    })
  }, [entries, keyword, level])

  const stats = useMemo(() => {
    const counters = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 }
    entries.forEach((entry) => {
      counters[entry.level] = (counters[entry.level] ?? 0) + 1
    })
    return counters
  }, [entries])

  return (
    <div className="space-y-4">
      <PageHeader
        title="系统日志"
        subtitle="推理与接口调用的实时日志流，来自模拟引擎；支持按级别、关键字过滤并导出为文本。"
      />
      <div className="grid gap-4 xl:grid-cols-12">
      <div className="xl:col-span-9">
        <Panel className="flex h-[calc(100vh-190px)] min-h-[420px] flex-col overflow-hidden">
          <PanelHeader
            title="推理与系统日志"
            subtitle={`SSE 实时推送 · 缓冲 ${entries.length} 条 · ${connected ? '已连接' : '重连中'}`}
            icon={<Terminal size={14} />}
            actions={
              <>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="过滤关键字"
                  className="h-9 w-40 rounded-control border border-ink-600 bg-ink-850 px-2.5 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-signal-cyan"
                />
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="h-9 rounded-control border border-ink-600 bg-ink-850 px-2 text-[12.5px] text-text-primary outline-none focus:border-signal-cyan"
                >
                  {LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {item || '全部级别'}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setPaused((value) => !value)}>
                  {paused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                  {paused ? `继续${pending > 0 ? ` (${pending})` : ''}` : '暂停'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      `a18-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.txt`,
                      filtered.map((entry) => `${entry.ts} ${entry.level.padEnd(5)} [${entry.scope}] ${entry.message}`).join('\r\n'),
                    )
                  }
                  disabled={filtered.length === 0}
                >
                  <Download size={13} />
                  导出
                </Button>
              </>
            }
          />
          <PanelBody className="min-h-0 flex-1 overflow-y-auto bg-ink-800/30 p-0">
            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState title="暂无匹配日志" description="执行一次检测，即可看到载入、分支推理、融合与后处理的分阶段日志。" />
              </div>
            ) : (
              <ol className="divide-y divide-ink-700/50">
                {filtered.map((entry) => (
                  <li key={entry.seq} className="flex gap-2 px-3.5 py-[6px] text-[12px] leading-relaxed hover:bg-ink-850">
                    <span className="num w-[46px] shrink-0 text-right text-text-muted">{entry.seq}</span>
                    <span className="num w-[120px] shrink-0 text-text-muted">{entry.ts.slice(11)}</span>
                    <span className={cn('w-[46px] shrink-0 font-semibold', LEVEL_TONE[entry.level])}>{entry.level}</span>
                    <span className="w-[62px] shrink-0 text-signal-blue">{entry.scope}</span>
                    <span className="min-w-0 flex-1 text-text-secondary">{entry.message}</span>
                    {entry.runId ? <span className="num shrink-0 text-[11px] text-text-muted">{entry.runId}</span> : null}
                  </li>
                ))}
              </ol>
            )}
            <div ref={bottomRef} />
          </PanelBody>
        </Panel>
      </div>

      <div className="space-y-3 xl:col-span-3">
        <Panel>
          <PanelHeader title="引擎状态" subtitle="模拟模式，无真实权重" icon={<Terminal size={14} />} />
          <PanelBody className="space-y-1.5 text-[11.5px]">
            <Row label="运行模式" value={<Badge tone="cyan">{info?.mode ?? '—'}</Badge>} />
            <Row label="JDK" value={<span className="num">{info?.jdk ?? '—'}</span>} />
            <Row label="端口" value={<span className="num">{info?.port ?? '—'}</span>} />
            <Row label="样例场景" value={<span className="num">{info?.scenarioCount ?? '—'}</span>} />
            <Row label="历史任务" value={<span className="num">{info?.runCount ?? '—'} / {info?.historyLimit ?? '—'}</span>} />
            <div className="space-y-0.5 pt-1">
              <div className="text-text-muted">数据目录</div>
              <div
                className="num truncate text-[11px] text-text-secondary"
                title={info?.dataDir ?? ''}
              >
                {info?.dataDir ?? '—'}
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="日志级别统计" subtitle="当前缓冲区" />
          <PanelBody className="space-y-1.5">
            {(['INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between text-[11.5px]">
                <span className={cn('font-mono', LEVEL_TONE[key])}>{key}</span>
                <span className="num text-text-primary">{stats[key] ?? 0}</span>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="WBF 分支权重" subtitle="来自真实实验配置" />
          <PanelBody className="space-y-1 text-[11px]">
            {modelRows(info).map((row) => (
              <div key={row.name} className="flex items-center justify-between">
                <span className="text-text-secondary">
                  {row.name}
                  <span className="ml-1 text-[10px] text-text-muted">{row.backbone}</span>
                </span>
                <span className="num text-signal-cyan">{row.weight.toFixed(2)}</span>
              </div>
            ))}
            {!info ? <span className="text-text-muted">加载中…</span> : null}
          </PanelBody>
        </Panel>
      </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  )
}

function modelRows(info: SystemInfo | null) {
  return (info?.models ?? []).map((model) => ({
    name: model.name,
    backbone: model.backbone,
    weight: model.weight,
  }))
}
