export type Modality = 'rgb' | 'ir'
export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export type BranchKey = 'rgb' | 'ir' | 'dual'
export type StageKey = 'LOAD' | 'RGB' | 'IR' | 'DUAL' | 'FUSE' | 'POST' | 'DONE'

export interface ScenarioSummary {
  id: string
  name: string
  weather: string
  terrain: string
  density: string
  description: string
  width: number
  height: number
  objectCount: number
  rgbUrl: string
  irUrl: string
}

export interface SceneObject {
  id: number
  cls: string
  box: [number, number, number, number]
}

export interface Scenario extends ScenarioSummary {
  objects: SceneObject[]
}

export interface Detection {
  cls: string
  conf: number
  box: [number, number, number, number]
}

export interface FusedDetection extends Detection {
  sources: string[]
}

export interface ModelBranch {
  name: string
  weight: number
  elapsedMs: number
  detections: Detection[]
}

export interface BranchResult {
  weight: number
  elapsedMs: number
  detections: Detection[]
  models?: ModelBranch[]
}

export interface Metrics {
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
}

export interface RunParams {
  conf: number
  iou: number
  imgsz: number
  branches: Record<BranchKey, boolean>
}

export interface Source {
  type: 'scenario' | 'upload'
  id: string
  name: string
}

export interface ImageInfo {
  width: number
  height: number
  rgbUrl: string | null
  irUrl: string | null
}

export interface RunRecord {
  runId: string
  status: RunStatus
  createdAt: string
  finishedAt: string | null
  source: Source
  image: ImageInfo
  params: RunParams
  branches: Record<string, BranchResult> | null
  fused: FusedDetection[] | null
  metrics: Metrics | null
  elapsedMs: number
  batchId: string | null
  error: string | null
}

export interface RunSummary {
  runId: string
  status: RunStatus
  createdAt: string
  source: Source
  fusedCount: number
  elapsedMs: number
  recall: number | null
  batchId: string | null
}

export interface PageResult<T> {
  items: T[]
  page: number
  size: number
  total: number
  totalPages: number
}

export interface BatchJob {
  batchId: string
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'
  createdAt: string
  total: number
  completed: number
  failed: number
  runIds: string[]
  params: RunParams
}

export interface LogEntry {
  seq: number
  ts: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  scope: string
  message: string
  runId: string | null
}

export interface UploadInfo {
  uploadId: string
  rgbUrl: string | null
  irUrl: string | null
  width: number
  height: number
}

export interface ProgressEvent {
  stage: string
  percent: number
  message: string
  ts: string
}

export interface ModelDescriptor {
  name: string
  branch: string
  backbone: string
  weight: number
  simulated: boolean
}

export interface SystemInfo {
  mode: string
  engine: string
  version: string
  jdk: string
  port: string
  dataDir: string
  scenarioCount: number
  runCount: number
  historyLimit: number
  branchWeights: Record<string, number | Record<string, number>>
  models: ModelDescriptor[]
  classes: string[]
}
