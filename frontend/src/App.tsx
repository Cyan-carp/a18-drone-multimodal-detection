import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/feedback'

const WorkbenchPage = lazy(() => import('@/pages/WorkbenchPage'))
const TasksPage = lazy(() => import('@/pages/TasksPage'))
const LogsPage = lazy(() => import('@/pages/LogsPage'))

function PageFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WorkbenchPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
