import { useCallback, useEffect, useState } from 'react'

// Follows only what the browser reports (navigator.onLine and online/offline events).
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const recheck = useCallback(() => setOnline(navigator.onLine), [])

  return { online, recheck }
}
