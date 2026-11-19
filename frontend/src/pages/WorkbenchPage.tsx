import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Radio, ScanSearch, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api, streamRun } from '@/lib/api'
import type { RunParams, RunRecord, Scenario, ScenarioSummary, UploadInfo } from '@/lib/types'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { Segmented } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScenePicker } from '@/components/detection/ScenePicker'
import { UploadPanel } from '@/components/detection/UploadPanel'
import { DualCanvas } from '@/components/detection/DualCanvas'
import type { RenderBox } from '@/components/detection/DualCanvas'
import { BranchToolbar, ClassLegend } from '@/components/detection/BranchToolbar'
import type { ViewMode } from '@/components/detection/BranchToolbar'
import { ParamPanel } from '@/components/detection/ParamPanel'
import { RunProgress } from '@/components/detection/RunProgress'
import { DetectionTable } from '@/components/detection/DetectionTable'
import { StatCards } from '@/components/detection/StatCards'
import { ClassBars } from '@/components/detection/ClassBars'
import { MetricCompare } from '@/components/detection/MetricCompare'
import { formatTime } from '@/lib/format'

const DEFAULT_PARAMS: RunParams = {
  conf: 0.1,
  iou: 0.58,
  imgsz: 1024,
  branches: { rgb: true, ir: true, dual: true },
}

export default function WorkbenchPage() {
  const [scenes, setScenes] = useState<ScenarioSummary[]>([])
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [sourceMode, setSourceMode] = useState<'scenario' | 'upload'>('scenario')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scene, setScene] = useState<Scenario | null>(null)

  const [rgbFile, setRgbFile] = useState<File | null>(null)
  const [irFile, setIrFile] = useState<File | null>(null)
  const [uploadInfo, setUploadInfo] = useState<UploadInfo | null>(null)
  const [uploading, setUploading] = useState(false)

  const [params, setParams] = useState<RunParams>(DEFAULT_PARAMS)
  const [run, setRun] = useState<RunRecord | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ stage: '', percent: 0, message: '' })

  const [view, setView] = useState<ViewMode>('fused')
  const [showGroundTruth, setShowGroundTruth] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const closerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    api
      .scenarios()
      .then((list) => {
        setScenes(list)
        if (list.length > 0) setSelectedId((current) => current ?? list[0].id)
      })
      .catch((error) => {
        console.error('[workbench] scenarios failed', error)
        toast.error('样例场景加载失败，请确认后端已启动')
      })
      .finally(() => setLoadingScenes(false))
  }, [])

  useEffect(() => {
    if (!selectedId || sourceMode !== 'scenario') return
    api
      .scenario(selectedId)
      .then(setScene)
      .catch((error) => {
        console.error('[workbench] scenario detail failed', error)
        setScene(null)
      })
  }, [selectedId, sourceMode])

  useEffect(() => () => closerRef.current?.(), [])

  const handleSelectFiles = useCallback((modality: 'rgb' | 'ir', file: File | null) => {
    if (modality === 'rgb') setRgbFile(file)
    else setIrFile(file)
    setUploadInfo(null)
    setRun(null)
    setProgress({ stage: '', percent: 0, message: '' })
  }, [])

  const startRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    setRun(null)
    setHoveredIndex(null)
    setProgress({ stage: 'LOAD', percent: 2, message: '正在准备检测任务' })

    try {
      let sourceId: string
      let sourceType: 'scenario' | 'upload'

      if (sourceMode === 'scenario') {
        if (!selectedId) {
          toast.warning('请先选择一个样例场景')
          setRunning(false)
          return
        }
        sourceId = selectedId
        sourceType = 'scenario'
      } else {
        if (!rgbFile && !irFile) {
          toast.warning('请先选择至少一张本地图像')
          setRunning(false)
          return
        }
        setUploading(true)
        const info = await api.uploadFiles(rgbFile, irFile)
        setUploadInfo(info)
        sourceId = info.uploadId
        sourceType = 'upload'
        setUploading(false)
      }

      const created = await api.createRun({ sourceType, sourceId, params })
      closerRef.current?.()
      closerRef.current = streamRun(created.runId, {
        onProgress: (payload) => setProgress(payload),
        onResult: (record) => {
          setRun(record)
          setRunning(false)
          toast.success(`检测完成：${record.fused?.length ?? 0} 个目标，耗时 ${record.elapsedMs} ms`)
        },
        onError: (message) => {
          setRunning(false)
          toast.error(`检测失败：${message}`)
        },
      })
    } catch (error) {
      console.error('[workbench] run failed', error)
      toast.error(error instanceof Error ? error.message : '检测请求失败')
      setRunning(false)
      setUploading(false)
    }
  }, [irFile, params, rgbFile, running, selectedId, sourceMode])

  const boxes: RenderBox[] = useMemo(() => {
    if (!run) return []
    if (view === 'fused') return run.fused ?? []
    return run.branches?.[view]?.detections ?? []
  }, [run, view])

  const counts = useMemo(
    () => ({
      fused: run?.fused?.length ?? 0,
      rgb: run?.branches?.rgb?.detections?.length ?? 0,
      ir: run?.branches?.ir?.detections?.length ?? 0,
      dual: run?.branches?.dual?.detections?.length ?? 0,
    }),
    [run],
  )

  const tableRows = useMemo(
    () =>
      view === 'fused'
        ? run?.fused ?? []
        : (run?.branches?.[view]?.detections ?? []).map((item) => ({ ...item, sources: [view] })),
    [run, view],
  )

  const avgConfidence = boxes.length > 0 ? boxes.reduce((sum, item) => sum + item.conf, 0) / boxes.length : 0
  const rgbUrl = sourceMode === 'scenario' ? scene?.rgbUrl ?? null : uploadInfo?.rgbUrl ?? null
  const irUrl = sourceMode === 'scenario' ? scene?.irUrl ?? null : uploadInfo?.irUrl ?? null
  const size = {
    width: run?.image.width || scene?.width || 1024,
    height: run?.image.height || scene?.height || 1024,
  }
  // 本地上传的图像没有真值：不能用上一张样例场景的标注去覆盖它
  const groundTruth = sourceMode === 'scenario' ? scene?.objects ?? [] : []

  return (
    <div className="space-y-4">
      <PageHeader
        title="检测工作台"
        subtitle="选择内置场景或上传双模态图像，查看分支推理与 WBF 融合结果；所有数值来自模拟引擎，标注为模拟模式。"
      />
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="order-2 space-y-4 xl:order-1 xl:col-span-3">
          <Panel>
            <PanelHeader
              title="检测输入"
              subtitle={sourceMode === 'scenario' ? '内置样例场景（含真值）' : '本地上传双模态图像'}
              icon={<Image size={14} />}
              actions={
                <Segmented
                  value={sourceMode}
                  options={[
                    { value: 'scenario', label: '样例' },
                    { value: 'upload', label: '上传' },
                  ]}
                  onChange={(mode) => {
                    setSourceMode(mode)
                    setRun(null)
                    setProgress({ stage: '', percent: 0, message: '' })
                  }}
                  disabled={running}
                />
              }
            />
            <PanelBody className="space-y-2.5">
              {sourceMode === 'scenario' ? (
                <>
                  <ScenePicker
                    scenes={scenes}
                    selectedId={selectedId}
                    onSelect={(id) => {
                      setSelectedId(id)
                      setRun(null)
                      setProgress({ stage: '', percent: 0, message: '' })
                    }}
                    loading={loadingScenes}
                    disabled={running}
                  />
                  {scene ? (
                    <div className="space-y-1 rounded-md border border-ink-700 bg-ink-900/70 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-text-primary">{scene.name}</span>
                        <Badge tone="cyan">{scene.objectCount} 目标</Badge>
                      </div>
                      <p className="text-[10.5px] leading-relaxed text-text-muted">{scene.description}</p>
                      <div className="flex gap-1.5 pt-0.5">
                        <Badge tone="neutral">{scene.weather}</Badge>
                        <Badge tone="neutral">{scene.terrain}</Badge>
                        <Badge tone="neutral">密度 {scene.density}</Badge>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <UploadPanel
                  rgb={rgbFile}
                  ir={irFile}
                  onSelect={handleSelectFiles}
                  disabled={running || uploading}
                />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="与真值比对" subtitle="仅内置场景提供标注" icon={<ScanSearch size={14} />} />
            <PanelBody className="space-y-2.5">
              <MetricCompare metrics={run?.metrics ?? null} hasRun={Boolean(run)} />
              <ClassBars detections={boxes} groundTruth={sourceMode === 'scenario' ? groundTruth : undefined} />
              <ClassLegend classes={Object.keys({ car: 1, truck: 1, bus: 1, van: 1, freight_car: 1 })} />
            </PanelBody>
          </Panel>
        </div>

        <div className="order-1 space-y-4 xl:order-2 xl:col-span-6">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="双模态成像对照"
              subtitle={run ? `${run.runId} · ${formatTime(run.createdAt)}` : 'RGB 与红外同坐标叠加检测框'}
              icon={<Radio size={14} />}
              actions={
                <span className="num text-[10.5px] text-text-muted">
                  {size.width}×{size.height}
                </span>
              }
            />
            <BranchToolbar
              view={view}
              onViewChange={setView}
              showGroundTruth={showGroundTruth}
              onToggleGroundTruth={() => setShowGroundTruth((value) => !value)}
              showLabels={showLabels}
              onToggleLabels={() => setShowLabels((value) => !value)}
              counts={counts}
              groundTruthCount={groundTruth.length}
            />
            <PanelBody>
              <DualCanvas
                rgbUrl={rgbUrl}
                irUrl={irUrl}
                boxes={boxes}
                groundTruth={groundTruth}
                showGroundTruth={showGroundTruth}
                showLabels={showLabels}
                visible={view !== 'ir'}
                hoveredIndex={hoveredIndex}
                onHover={setHoveredIndex}
                size={size}
              />
            </PanelBody>
          </Panel>

          <StatCards
            count={counts.fused}
            avgConfidence={avgConfidence}
            elapsedMs={run?.elapsedMs ?? 0}
            metrics={run?.metrics ?? null}
          />

          <Panel>
            <PanelHeader
              title="检测明细"
              subtitle={`当前视图：${view === 'fused' ? 'WBF 融合' : view.toUpperCase()} · ${boxes.length} 条`}
              icon={<Sparkles size={14} />}
            />
            <PanelBody className="p-0">
              <DetectionTable rows={tableRows} hoveredIndex={hoveredIndex} onHover={setHoveredIndex} />
            </PanelBody>
          </Panel>
        </div>

        <div className="order-3 space-y-4 xl:col-span-3">
          <Panel>
            <PanelHeader title="推理参数" subtitle="与真实 WBF 配置对齐" icon={<Radio size={14} />} />
            <PanelBody>
              <ParamPanel
                params={params}
                onChange={setParams}
                onRun={startRun}
                onReset={() => setParams(DEFAULT_PARAMS)}
                running={running || uploading}
                disabled={sourceMode === 'scenario' ? !selectedId : !rgbFile && !irFile}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="任务进度" subtitle="SSE 实时推送" icon={<Radio size={14} />} />
            <PanelBody>
              <RunProgress
                stage={progress.stage}
                percent={progress.percent}
                message={progress.message}
                running={running}
                elapsedMs={run?.elapsedMs}
                branches={params.branches}
              />
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
