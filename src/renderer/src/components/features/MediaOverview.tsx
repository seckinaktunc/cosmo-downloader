import { useUiStore } from '../../stores/uiStore'
import { HistoryPanel } from './HistoryPanel'
import { MetadataPanel } from './MetadataPanel'
import { QueuePanel } from './QueuePanel'

export function MediaOverview(): React.JSX.Element {
  const activePanel = useUiStore((state) => state.activePanel)

  const panel =
    activePanel === 'queue' ? (
      <QueuePanel />
    ) : activePanel === 'history' ? (
      <HistoryPanel />
    ) : (
      <MetadataPanel />
    )

  return <section className="flex flex-col h-full text-white">{panel}</section>
}
