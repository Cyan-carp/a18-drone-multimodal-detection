import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { SystemInfo } from '@/lib/types'

export function useSystemInfo(pollMs = 15000) {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [online, setOnline] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    api
      .systemInfo()
      .then((data) => {
        setInfo(data)
        setOnline(true)
      })
      .catch((error) => {
        console.error('[system] info failed', error)
        setOnline(false)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, pollMs)
    return () => window.clearInterval(timer)
  }, [refresh, pollMs])

  return { info, online, loading, refresh }
}
