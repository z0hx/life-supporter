import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { ToastProvider } from './components/Toast'
import { Home } from './screens/Home'
import { MemoList } from './screens/MemoList'
import { Calc, EMPTY_DRAFT, type CalcDraft } from './screens/Calc'
import { History } from './screens/History'
import { GoodNew } from './screens/GoodNew'
import { ActivityLog } from './screens/ActivityLog'
import { Products } from './screens/Products'
import { Settings } from './screens/Settings'
import { usePWAUpdate } from './usePWAUpdate'

function useHashRoute(): [string, (r: string) => void] {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const onChange = () => setRoute(location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return [route, (r) => (location.hash = r)]
}

function Router() {
  const [route, navigate] = useHashRoute()
  const { ready } = useStore()
  const [calcDraft, setCalcDraft] = useState<CalcDraft>(EMPTY_DRAFT)

  if (!ready) return <div className="app" />

  return (
    <div className="app">
      {route === '/memos' ? (
        <MemoList navigate={navigate} />
      ) : route === '/calc' ? (
        <Calc draft={calcDraft} setDraft={setCalcDraft} navigate={navigate} />
      ) : route === '/history' ? (
        <History navigate={navigate} restoreDraft={setCalcDraft} />
      ) : route === '/goodnew' ? (
        <GoodNew navigate={navigate} />
      ) : route === '/activity' ? (
        <ActivityLog navigate={navigate} />
      ) : route.startsWith('/products') ? (
        <Products route={route} navigate={navigate} />
      ) : route === '/settings' ? (
        <Settings navigate={navigate} />
      ) : (
        <Home navigate={navigate} />
      )}
    </div>
  )
}

function UpdateBar() {
  const { needRefresh, applyUpdate } = usePWAUpdate()
  if (!needRefresh) return null
  return (
    <div className="update-bar" role="status">
      <span>新しいバージョンがあります</span>
      <button onClick={applyUpdate}>更新</button>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Router />
        <UpdateBar />
      </ToastProvider>
    </StoreProvider>
  )
}
