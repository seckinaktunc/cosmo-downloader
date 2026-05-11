import { cn } from '@renderer/lib/utils';
import { useUiStore } from '../../stores/uiStore';
import { HistoryPanel } from './HistoryPanel';
import { MetadataPanel } from './MetadataPanel';
import { QueuePanel } from './QueuePanel';

export function MediaOverview(): React.JSX.Element {
  const activePanel = useUiStore((state) => state.activePanel);
  const resolvedPanel = activePanel ?? 'metadata';

  return (
    <section className="relative flex h-full flex-col text-white">
      <div
        className={cn(
          'min-h-0 flex-1',
          resolvedPanel === 'metadata'
            ? 'block h-full'
            : 'pointer-events-none absolute inset-0 overflow-hidden opacity-0'
        )}
        aria-hidden={resolvedPanel === 'metadata' ? undefined : true}
      >
        <MetadataPanel />
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          resolvedPanel === 'queue'
            ? 'block h-full'
            : 'pointer-events-none absolute inset-0 overflow-hidden opacity-0'
        )}
        aria-hidden={resolvedPanel === 'queue' ? undefined : true}
      >
        <QueuePanel />
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          resolvedPanel === 'history'
            ? 'block h-full'
            : 'pointer-events-none absolute inset-0 overflow-hidden opacity-0'
        )}
        aria-hidden={resolvedPanel === 'history' ? undefined : true}
      >
        <HistoryPanel isActive={resolvedPanel === 'history'} />
      </div>
    </section>
  );
}
