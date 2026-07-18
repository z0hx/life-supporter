import { useStore } from '../store'
import { DailyLogScreen } from './DailyLogScreen'

export function ActivityLog({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore()
  return (
    <DailyLogScreen
      navigate={navigate}
      title="行動記録"
      placeholder="今日やったこと・行動を書き留めましょう…"
      addedToast="行動記録を追加しました"
      deleteMessage="この行動記録を削除します。よろしいですか?"
      emptyMessage={'まだ記録がありません。\n今日の行動を書き留めてみましょう。'}
      entries={store.activityLogs}
      onAdd={store.addActivityLog}
      onUpdate={store.updateActivityLog}
      onRemove={store.removeActivityLog}
    />
  )
}
