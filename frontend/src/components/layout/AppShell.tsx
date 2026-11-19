import { Outlet } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { useSystemInfo } from '@/hooks/useSystemInfo'

export function AppShell() {
  const { info, online } = useSystemInfo()

  return (
    <div className="min-h-screen bg-ink-950 text-text-primary">
      <SideNav />
      <div className="pl-[92px]">
        <TopBar info={info} online={online} />
        <main className="px-6 py-4 lg:px-[34px] lg:pb-6">
          <div className="mx-auto w-full max-w-[1360px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
