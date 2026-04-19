import { useTranslation } from 'react-i18next'
import { useUpdateStore } from '../../stores/updateStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function UpdatePrompt(): React.JSX.Element | null {
  const { t } = useTranslation()
  const updateState = useUpdateStore((state) => state.state)
  const dismissedAvailableVersion = useUpdateStore((state) => state.dismissedAvailableVersion)
  const dismissedDownloadedVersion = useUpdateStore((state) => state.dismissedDownloadedVersion)
  const download = useUpdateStore((state) => state.download)
  const install = useUpdateStore((state) => state.install)
  const dismissAvailable = useUpdateStore((state) => state.dismissAvailable)
  const dismissDownloaded = useUpdateStore((state) => state.dismissDownloaded)
  const version = updateState.updateInfo?.version

  if (updateState.status === 'available' && version !== dismissedAvailableVersion) {
    return (
      <ConfirmDialog
        title={t('updates.availableTitle')}
        message={t('updates.availableMessage', { version })}
        confirmLabel={t('updates.download')}
        cancelLabel={t('updates.later')}
        onConfirm={() => void download()}
        onCancel={dismissAvailable}
      />
    )
  }

  if (updateState.status === 'downloaded' && version !== dismissedDownloadedVersion) {
    return (
      <ConfirmDialog
        title={t('updates.downloadedTitle')}
        message={updateState.error ?? t('updates.downloadedMessage', { version })}
        confirmLabel={t('updates.restartNow')}
        cancelLabel={t('updates.later')}
        onConfirm={() => void install()}
        onCancel={dismissDownloaded}
      />
    )
  }

  return null
}
