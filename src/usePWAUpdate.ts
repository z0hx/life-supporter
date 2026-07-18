import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000 // 1時間

// Service Worker を登録し、新バージョン検知(needRefresh)と適用関数を返す。
// 長時間開いたままの PWA でも更新に気づけるよう、定期チェックと復帰時チェックを行う。
export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef<(reloadPage?: boolean) => Promise<void>>()

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    let onVisible: (() => void) | undefined

    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        const check = () => {
          if (registration.installing || !navigator.onLine) return
          registration.update().catch(() => {})
        }
        timer = setInterval(check, UPDATE_CHECK_INTERVAL)
        onVisible = () => {
          if (document.visibilityState === 'visible') check()
        }
        document.addEventListener('visibilitychange', onVisible)
      }
    })

    return () => {
      if (timer) clearInterval(timer)
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // 適用: 待機中の SW を有効化 → controllerchange でページが自動リロードされる
  const applyUpdate = () => {
    setNeedRefresh(false)
    updateRef.current?.(true)
  }

  return { needRefresh, applyUpdate }
}
