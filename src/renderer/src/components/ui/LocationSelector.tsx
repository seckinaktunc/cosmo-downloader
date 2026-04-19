import Icon, { type IconName } from '../miscellaneous/Icon'
import { Button } from './Button'
import { cn } from '../../lib/utils'

type LocationSelectorMode = 'directory' | 'file'

type LocationSelectorProps = {
  mode: LocationSelectorMode
  label: string
  value?: string
  placeholder: string
  chooseLabel: string
  icon?: IconName
  disabled?: boolean
  className?: string
  labelClassName?: string
  pathClassName?: string
  layout?: 'inline' | 'stacked'
  buttonSize?: 'xs' | 'sm'
  onChoose: () => void
  onOpen: () => void
}

export function LocationSelector({
  mode,
  label,
  value,
  placeholder,
  chooseLabel,
  icon = mode === 'directory' ? 'folder' : 'folderOpen',
  disabled = false,
  className,
  labelClassName,
  pathClassName,
  layout = 'inline',
  buttonSize = 'sm',
  onChoose,
  onOpen
}: LocationSelectorProps): React.JSX.Element {
  const pathButton = (
    <button
      type="button"
      className={cn(
        'flex flex-1 min-w-0 items-center h-10 gap-2 bg-dark px-3 py-2 text-left text-sm text-white/50 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed cursor-pointer',
        pathClassName
      )}
      disabled={disabled || !value}
      onClick={onOpen}
    >
      <Icon name={icon} className="shrink-0" />
      <span className="min-w-0 truncate whitespace-nowrap">{value ?? placeholder}</span>
    </button>
  )
  const chooseButton = (
    <Button
      type="button"
      size={buttonSize}
      label={chooseLabel}
      className="rounded-none border-none"
      active={false}
      disabled={disabled}
      onClick={onChoose}
    />
  )

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col gap-1', className, disabled && 'opacity-40')}>
        <span className={cn('text-sm font-medium text-white/50', labelClassName)}>{label}</span>
        <div className="flex border border-white/10 divide-x divide-white/10">
          {pathButton}
          {chooseButton}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-between gap-16 min-w-0', className)}>
      <div className={cn('font-medium text-white/50 text-nowrap', labelClassName)}>{label}</div>
      <div className="flex min-w-0 flex-1 items-center border border-white/10 divide-x divide-white/10">
        {pathButton}
        {chooseButton}
      </div>
    </div>
  )
}
