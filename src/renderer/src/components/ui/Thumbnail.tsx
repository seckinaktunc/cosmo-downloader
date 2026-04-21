import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDuration } from '../../lib/formatters'
import { cn } from '../../lib/utils'
import Icon, { type IconName } from '../miscellaneous/Icon'
import { Button } from './Button'

type ThumbnailActionSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs'

type ThumbnailProps = {
  src?: string
  title?: string
  duration?: number
  badge?: string
  className?: string
  imageClassName?: string
  placeholderClassName?: string
  actionSize?: ThumbnailActionSize
  showPlaceholderIcon?: boolean
  actions?: ThumbnailAction[]
  actionsEnabled?: boolean
  onClick?: (event: MouseEvent<HTMLDivElement>) => void
}

export type ThumbnailAction = {
  id: string
  label: string
  icon: IconName
  disabled?: boolean
  feedbackLabel?: string
  failureLabel?: string
  onSelect: () => boolean | void | Promise<boolean | void>
}

export function Thumbnail({
  src,
  title,
  duration,
  badge,
  className,
  imageClassName,
  placeholderClassName,
  actionSize = 'xl',
  showPlaceholderIcon = true,
  actions,
  actionsEnabled = true,
  onClick
}: ThumbnailProps): React.JSX.Element {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<{ actionId: string; label: string } | null>(null)

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timer = window.setTimeout(() => setFeedback(null), 1500)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const defaultActions = useMemo<ThumbnailAction[]>(() => {
    if (!src) {
      return []
    }

    return [
      {
        id: 'download',
        icon: 'download',
        label: t('thumbnail.download'),
        feedbackLabel: t('thumbnail.saved'),
        onSelect: async () => {
          const result = await window.cosmo.thumbnail.download({ url: src, title })
          return result.ok && result.data != null
        }
      },
      {
        id: 'copy-image',
        icon: 'copy',
        label: t('thumbnail.copyImage'),
        feedbackLabel: t('thumbnail.copied'),
        onSelect: async () => {
          const result = await window.cosmo.thumbnail.copyImage({ url: src, title })
          return result.ok
        }
      },
      {
        id: 'open-browser',
        icon: 'external',
        label: t('thumbnail.openBrowser'),
        feedbackLabel: t('thumbnail.opened'),
        onSelect: async () => {
          const result = await window.cosmo.thumbnail.openExternal({ url: src, title })
          return result.ok
        }
      }
    ]
  }, [src, t, title])

  const resolvedActions = actions ?? defaultActions

  const runThumbnailAction = async (action: ThumbnailAction): Promise<void> => {
    if (action.disabled) {
      return
    }

    setFeedback(null)
    let successful = false
    try {
      const result = await action.onSelect()
      successful = result !== false
    } catch {
      successful = false
    }
    const label = successful
      ? (action.feedbackLabel ?? t('thumbnail.done'))
      : (action.failureLabel ?? t('thumbnail.failed'))
    setFeedback({ actionId: action.id, label })
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-white/5', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {src ? (
        <div
          className="h-full w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.9), rgba(0,0,0,0.9)), url(${src})`
          }}
        >
          <img
            src={src}
            alt=""
            className={cn('h-full w-full object-contain', imageClassName)}
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div
          className={cn(
            'flex h-full min-h-16 items-center justify-center text-white',
            placeholderClassName
          )}
        >
          {showPlaceholderIcon ? <Icon name="video" size={64} className="opacity-50" /> : null}
        </div>
      )}

      {duration ? (
        <span className="absolute bottom-1 right-1 bg-black/50 px-1 py-0.5 rounded-sm text-sm font-bold">
          {formatDuration(duration)}
        </span>
      ) : null}

      {badge ? (
        <span className="absolute bottom-1 right-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
          {badge}
        </span>
      ) : null}

      {src && actionsEnabled && resolvedActions.length > 0 ? (
        <div
          className="opacity-0 hover:opacity-100 absolute flex inset-0 w-full h-full justify-center items-center bg-black/90"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {resolvedActions.map((action) => (
            <Button
              key={action.id}
              icon={action.icon}
              onlyIcon
              ghost
              label={action.label}
              tooltip={feedback?.actionId === action.id ? feedback.label : action.label}
              size={actionSize}
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation()
                void runThumbnailAction(action)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
