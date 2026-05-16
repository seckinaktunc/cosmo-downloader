import { useEffect } from 'react';
import { useUiStore } from '@renderer/stores/uiStore';
import { useTranslation } from 'react-i18next';
import type { DownloadHistoryEntry } from '../../../../shared/types';
import { formatDuration } from '../../lib/formatters';
import { getHistoryQueueAction } from '../../lib/historyEntryActions';
import { getContentAfterItemActivation } from '../../lib/logSources';
import { useHistoryStore } from '../../stores/historyStore';
import type { ActionMenuItem } from '../ui/ActionMenu';
import { InteractiveItemPanel } from '../ui/InteractiveItemPanel';
import type { ThumbnailAction } from '../ui/Thumbnail';

type HistoryPanelProps = {
  isActive: boolean;
};

export function HistoryPanel({ isActive }: HistoryPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const entries = useHistoryStore((state) => state.entries);
  const totalCount = useHistoryStore((state) => state.totalCount);
  const isLoadingMore = useHistoryStore((state) => state.isLoadingMore);
  const hasOpenedPanel = useHistoryStore((state) => state.hasOpenedPanel);
  const loadMore = useHistoryStore((state) => state.loadMore);
  const markOpened = useHistoryStore((state) => state.markOpened);
  const remove = useHistoryStore((state) => state.remove);
  const removeMany = useHistoryStore((state) => state.removeMany);
  const clear = useHistoryStore((state) => state.clear);
  const requeue = useHistoryStore((state) => state.requeue);
  const openMedia = useHistoryStore((state) => state.openMedia);
  const openFolder = useHistoryStore((state) => state.openFolder);
  const copySource = useHistoryStore((state) => state.copySource);
  const activeExportTarget = useUiStore((state) => state.activeExportTarget);
  const activeContent = useUiStore((state) => state.activeContent);
  const setActiveExportTarget = useUiStore((state) => state.setActiveExportTarget);
  const setActiveContent = useUiStore((state) => state.setActiveContent);
  const closeMediaPanel = useUiStore((state) => state.closeMediaPanel);

  useEffect(() => {
    if (isActive && !hasOpenedPanel) {
      markOpened();
    }
  }, [hasOpenedPanel, isActive, markOpened]);

  const getActions = (entry: DownloadHistoryEntry): ActionMenuItem[] => {
    const queueAction = getHistoryQueueAction(entry.status);

    return [
      {
        id: 'open',
        label: t('history.actions.openMedia'),
        icon: 'video',
        disabled: !entry.outputPath,
        onSelect: () => void openMedia(entry.id)
      },
      {
        id: 'open-folder',
        label: t('history.actions.openFolder'),
        icon: 'folderOpen',
        disabled: !entry.outputPath,
        onSelect: () => void openFolder(entry.id)
      },
      ...(queueAction
        ? [
            {
              id: queueAction,
              label: queueAction === 'download' ? t('queue.add') : t('history.actions.requeue'),
              icon: 'add',
              onSelect: () => void requeue(entry.id)
            } satisfies ActionMenuItem
          ]
        : []),
      {
        id: 'copy-source',
        label: t('history.actions.copyUrl'),
        icon: 'copy',
        onSelect: () => void copySource(entry.id)
      },
      {
        id: 'remove',
        label: t('queue.actions.remove'),
        icon: 'trash',
        danger: true,
        onSelect: () => void remove(entry.id)
      }
    ];
  };

  const getThumbnailActions = (entry: DownloadHistoryEntry): ThumbnailAction[] => [
    {
      id: 'open-media',
      label: t('history.actions.openMedia'),
      icon: 'video',
      disabled: !entry.outputPath,
      feedbackLabel: t('thumbnail.opened'),
      onSelect: () => openMedia(entry.id)
    },
    {
      id: 'open-folder',
      label: t('history.actions.openFolder'),
      icon: 'folderOpen',
      disabled: !entry.outputPath,
      feedbackLabel: t('thumbnail.opened'),
      onSelect: () => openFolder(entry.id)
    },
    {
      id: 'remove',
      label: t('queue.actions.remove'),
      icon: 'trash',
      feedbackLabel: t('thumbnail.removed'),
      onSelect: async () => {
        await remove(entry.id);
        return true;
      }
    }
  ];

  return (
    <InteractiveItemPanel
      title={t('history.title')}
      subtitle={
        totalCount === 0 ? t('history.empty') : t('history.itemCount', { count: totalCount })
      }
      items={entries}
      getId={(entry) => entry.id}
      getStatus={(entry) => entry.status}
      getTitle={(entry) => entry.metadata.title}
      getThumbnail={(entry) => entry.metadata.thumbnail}
      getThumbnailActions={getThumbnailActions}
      getThumbnailBadge={(entry) =>
        entry.metadata.duration ? formatDuration(entry.metadata.duration) : undefined
      }
      getMetaLabel={(entry) => new Date(entry.createdAt).toLocaleString()}
      getActions={getActions}
      getTopRightAction={(entry) => ({
        icon: 'close',
        label: t('queue.actions.remove'),
        onSelect: () => void remove(entry.id)
      })}
      activeItemId={activeExportTarget?.type === 'history' ? activeExportTarget.entryId : undefined}
      onActivateItem={(entry) => {
        setActiveExportTarget({ type: 'history', entryId: entry.id });
        setActiveContent(getContentAfterItemActivation(activeContent));
      }}
      onDeleteSelected={(entryIds) => void removeMany(entryIds)}
      onClearSelection={() => {
        if (activeExportTarget?.type === 'history') {
          setActiveExportTarget(null);
        }
      }}
      onClear={() => void clear()}
      onClose={closeMediaPanel}
      hasMore={entries.length < totalCount}
      isLoadingMore={isLoadingMore}
      onLoadMore={() => loadMore()}
      loadMoreEnabled={isActive}
      emptyDetail={t('common.noDetails')}
      clearLabel={t('actions.clear')}
      deleteLabel={(count) => t('actions.deleteCount', { count })}
      closeLabel={t('actions.close')}
      actionsLabel={(title) => t('actions.itemActions', { title })}
      menuLabel={t('history.itemActions')}
    />
  );
}
