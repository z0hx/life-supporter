import { useStore } from '../store'
import { DailyLogScreen } from './DailyLogScreen'

export function GoodNew({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore()
  return (
    <DailyLogScreen
      navigate={navigate}
      title="Good & New"
      placeholder="今日の良かったこと・新しい発見を書いてみましょう…"
      addedToast="Good & New を記録しました"
      deleteMessage="この Good & New を削除します。よろしいですか?"
      emptyMessage={'まだ記録がありません。\n今日の Good & New を書いてみましょう。'}
      entries={store.goodNews}
      onAdd={store.addGoodNew}
      onUpdate={store.updateGoodNew}
      onRemove={store.removeGoodNew}
    />
  )
}
