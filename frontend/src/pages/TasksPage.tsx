import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, Download, ListChecks, RefreshCw, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, downloadFile } from '@/lib/api'
import type { BatchJob, PageResult, RunRecord, RunSummary, ScenarioSummary } from '@/lib/types'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Drawer } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { DualCanvas } from '@/components/detection/DualCanvas'
import { DetectionTable } from '@/components/detection/DetectionTable'
import { formatMs, formatPercent, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<string, 'cyan' | 'green' | 'amber' | 'red' | 'neutral'> = {
  QUEUED: 'neutral',
  RUNNING: 'cyan',
  SUCCESS: 'green',
  FAILED: 'red',
  PARTIAL: 'amber',
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: '排队中',
  RUNNING: '执行中',
  SUCCESS: '成功',
  FAILED: '失败',
  PARTIAL: '部分成功',
}

export default function TasksPage() {
  const [scenes, setScenes] = useState<ScenarioSummary[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [batch, setBatch] = useState<BatchJob | null>(null)
  const [creating, setCreating] = useState(false)

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [result, setResult] = useState<PageResult<RunSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  const [detail, setDetail] = useState<RunRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  const loadRuns = useCallback(() => {
    setLoading(true)
    api
      .runs({ page, size: 10, status, keyword })
      .then(setResult)
      .catch((error) => {
        console.error('[tasks] list failed', error)
        toast.error('任务列表加载失败')
      })
      .finally(() => setLoading(false))
  }, [keyword, page, status])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    api
      .scenarios()
      .then(setScenes)
      .catch((error) => console.error('[tasks] scenarios failed', error))
  }, [])

  useEffect(() => {
    if (!batch || batch.status !== 'RUNNING') return
    const timer = window.setInterval(() => {
      api
        .batch(batch.batchId)
        .then((next) => {
          setBatch(next)
          if (next.status !== 'RUNNING') {
            loadRuns()
            toast.success(`批次结束：完成 ${next.completed}/${next.total}`)
          }
        })
        .catch((error) => console.error('[tasks] batch poll failed', error))
    }, 900)
    return () => window.clearInterval(timer)
  }, [batch, loadRuns])

  const createBatch = useCallback(async () => {
    if (picked.length === 0) {
      toast.warning('请先选择至少一个场景')
      return
    }
    setCreating(true)
    try {
      const job = await api.createBatch(picked, {
        conf: 0.1,
        iou: 0.58,
        imgsz: 1024,
        branches: { rgb: true, ir: true, dual: true },
      })
      setBatch(job)
      toast.success(`已创建批次 ${job.batchId}（${job.total} 个任务）`)
      setPage(1)
    } catch (error) {
      console.error('[tasks] create batch failed', error)
      toast.error(error instanceof Error ? error.message : '创建批次失败')
    } finally {
      setCreating(false)
    }
  }, [picked])

  const openDetail = useCallback((runId: string) => {
    setDetailLoading(true)
    api
      .run(runId)
      .then(setDetail)
      .catch((error) => {
        console.error('[tasks] detail failed', error)
        toast.error('任务详情加载失败')
      })
      .finally(() => setDetailLoading(false))
  }, [])

  const toggleSelected = (runId: string) => {
    setSelected((current) =>
      current.includes(runId) ? current.filter((item) => item !== runId) : [...current, runId],
    )
  }

  const removeSelected = async () => {
    if (selected.length === 0) return
    try {
      const response = await api.deleteRuns(selected)
      toast.success(`已删除 ${response.deleted} 条任务`)
      setSelected([])
      loadRuns()
    } catch (error) {
      console.error('[tasks] delete failed', error)
      toast.error('删除失败，运行中的任务不可删除')
    }
  }

  const items = result?.items ?? []
  const allChecked = items.length > 0 && items.every((item) => selected.includes(item.runId))

  const detailBoxes = useMemo(
    () => (detail?.fused ?? []).map((item) => ({ ...item })),
    [detail],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="任务中心"
        subtitle="一次选择多个场景提交批次，系统串行执行；点击任一任务可回放画布、查看参数快照并导出结果。"
      />
      <Panel>
        <PanelHeader
          title="批量检测"
          subtitle="选择多个样例场景，串行排队执行，进度实时汇总"
          icon={<ListChecks size={14} />}
          actions={
            <Button variant="solid" size="sm" onClick={createBatch} disabled={creating}>
              {creating ? '提交中…' : `提交批次（${picked.length}）`}
            </Button>
          }
        />
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {scenes.map((scene) => {
              const active = picked.includes(scene.id)
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() =>
                    setPicked((current) =>
                      current.includes(scene.id)
                        ? current.filter((id) => id !== scene.id)
                        : [...current, scene.id],
                    )
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors',
                    active
                      ? 'border-signal-cyan/60 bg-signal-cyan/10 text-signal-cyan'
                      : 'border-ink-700 bg-ink-900 text-text-secondary hover:border-ink-600',
                  )}
                >
                  {active ? <CheckSquare size={11} /> : <Square size={11} />}
                  {scene.id} · {scene.name}
                  <span className="num text-[9.5px] text-text-muted">{scene.objectCount}</span>
                </button>
              )
            })}
            {scenes.length === 0 ? <Skeleton className="h-7 w-40" /> : null}
          </div>

          {batch ? (
            <div className="space-y-1.5 rounded-md border border-ink-700 bg-ink-900/70 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <span className="num text-text-primary">{batch.batchId}</span>
                  <Badge tone={STATUS_TONE[batch.status] ?? 'neutral'} dot>
                    {STATUS_LABEL[batch.status] ?? batch.status}
                  </Badge>
                </span>
                <span className="num text-text-muted">
                  {batch.completed}/{batch.total} 完成 · {batch.failed} 失败
                </span>
              </div>
              <Progress value={(batch.completed / Math.max(1, batch.total)) * 100} tone={batch.status === 'SUCCESS' ? 'green' : 'cyan'} />
            </div>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="任务记录"
          subtitle="点击行查看回放与导出，支持多选删除"
          icon={<RefreshCw size={14} />}
          actions={
            <>
              <input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
                placeholder="按任务号或场景搜索"
                className="h-9 w-48 rounded-control border border-ink-600 bg-ink-850 px-2.5 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-signal-cyan"
              />
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-control border border-ink-600 bg-ink-850 px-2 text-[12.5px] text-text-primary outline-none focus:border-signal-cyan"
              >
                <option value="">全部状态</option>
                <option value="SUCCESS">成功</option>
                <option value="RUNNING">执行中</option>
                <option value="FAILED">失败</option>
              </select>
              <Button variant="ghost" size="sm" onClick={removeSelected} disabled={selected.length === 0}>
                <Trash2 size={13} />
                删除 {selected.length > 0 ? `(${selected.length})` : ''}
              </Button>
            </>
          }
        />
        <PanelBody className="overflow-x-auto p-0">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-3">
              <EmptyState title="还没有检测任务" description="在上方选择场景创建批次，或在检测工作台执行单次检测。" />
            </div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-ink-800 text-left text-[12px] text-text-secondary">
                  <th className="w-8 px-2.5 py-[13px]">
                    <button
                      type="button"
                      onClick={() => setSelected(allChecked ? [] : items.map((item) => item.runId))}
                      className="text-text-muted hover:text-signal-cyan"
                      aria-label="全选"
                    >
                      {allChecked ? <CheckSquare size={12} /> : <Square size={12} />}
                    </button>
                  </th>
                  <th className="px-2.5 py-[13px] font-normal">任务</th>
                  <th className="px-2.5 py-[13px] font-normal">来源</th>
                  <th className="px-2.5 py-[13px] font-normal">状态</th>
                  <th className="px-2.5 py-[13px] text-right font-normal">目标</th>
                  <th className="px-2.5 py-[13px] text-right font-normal">召回</th>
                  <th className="px-2.5 py-[13px] text-right font-normal">耗时</th>
                  <th className="px-2.5 py-[13px] text-right font-normal">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.runId}
                    onClick={() => openDetail(item.runId)}
                    className="cursor-pointer border-t border-ink-700/60 hover:bg-ink-800/60"
                  >
                    <td className="px-2.5 py-[13px]" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleSelected(item.runId)}
                        className="text-text-muted hover:text-signal-cyan"
                        aria-label={`选择 ${item.runId}`}
                      >
                        {selected.includes(item.runId) ? <CheckSquare size={12} /> : <Square size={12} />}
                      </button>
                    </td>
                    <td className="num px-2.5 py-[13px] text-text-primary">{item.runId}</td>
                    <td className="px-2.5 py-[13px] text-text-secondary">{item.source.name}</td>
                    <td className="px-2.5 py-[13px]">
                      <Badge tone={STATUS_TONE[item.status] ?? 'neutral'} dot>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </Badge>
                    </td>
                    <td className="num px-2.5 py-[13px] text-right text-text-primary">{item.fusedCount}</td>
                    <td className="num px-2.5 py-[13px] text-right text-text-secondary">
                      {item.recall === null ? '—' : formatPercent(item.recall, 0)}
                    </td>
                    <td className="num px-2.5 py-[13px] text-right text-text-secondary">{formatMs(item.elapsedMs)}</td>
                    <td className="num px-2.5 py-[13px] text-right text-text-muted">{formatTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelBody>
        <div className="flex items-center justify-between border-t border-ink-700 px-3 py-2 text-[11px] text-text-muted">
          <span>
            共 {result?.total ?? 0} 条 · 第 {result?.page ?? 1}/{result?.totalPages ?? 1} 页
          </span>
          <span className="flex gap-1.5">
            <Button variant="ghost" size="sm" disabled={(result?.page ?? 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              上一页
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={(result?.page ?? 1) >= (result?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </span>
        </div>
      </Panel>

      <Drawer
        open={Boolean(detail) || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `任务 ${detail.runId}` : '加载中…'}
        subtitle={detail ? `${detail.source.name} · ${formatTime(detail.createdAt)} · 耗时 ${formatMs(detail.elapsedMs)}` : undefined}
        footer={
          detail ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10.5px] text-text-muted">
                参数 conf {detail.params.conf.toFixed(2)} · iou {detail.params.iou.toFixed(2)} · imgsz {detail.params.imgsz}
              </span>
              <span className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(api.exportUrl(detail.runId, 'json'), `run_${detail.runId}.json`)}
                >
                  <Download size={12} /> JSON
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => downloadFile(api.exportUrl(detail.runId, 'csv'), `run_${detail.runId}.csv`)}
                >
                  <Download size={12} /> CSV
                </Button>
              </span>
            </div>
          ) : null
        }
      >
        {detailLoading && !detail ? (
          <Skeleton className="h-64 w-full" />
        ) : detail ? (
          <div className="space-y-3">
            <div className="rounded-md border border-ink-700 bg-ink-950 p-2">
              <DualCanvas
                rgbUrl={detail.image.rgbUrl}
                irUrl={detail.image.irUrl}
                boxes={detailBoxes}
                groundTruth={[]}
                showGroundTruth={false}
                showLabels
                visible
                hoveredIndex={hovered}
                onHover={setHovered}
                size={{ width: detail.image.width || 1024, height: detail.image.height || 1024 }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded border border-ink-700 bg-ink-900 px-2.5 py-[13px]">
                <div className="text-[10px] text-text-muted">融合目标</div>
                <div className="num text-[15px] text-text-primary">{detail.fused?.length ?? 0}</div>
              </div>
              <div className="rounded border border-ink-700 bg-ink-900 px-2.5 py-[13px]">
                <div className="text-[10px] text-text-muted">精确率</div>
                <div className="num text-[15px] text-signal-cyan">
                  {detail.metrics ? formatPercent(detail.metrics.precision, 1) : '—'}
                </div>
              </div>
              <div className="rounded border border-ink-700 bg-ink-900 px-2.5 py-[13px]">
                <div className="text-[10px] text-text-muted">召回率</div>
                <div className="num text-[15px] text-signal-green">
                  {detail.metrics ? formatPercent(detail.metrics.recall, 1) : '—'}
                </div>
              </div>
            </div>
            <DetectionTable rows={detail.fused ?? []} hoveredIndex={hovered} onHover={setHovered} maxHeight="300px" />
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
