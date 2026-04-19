import { cn } from '../../lib/utils'
import Icon from '../miscellaneous/Icon'
import { Tooltip } from './Tooltip'

type SwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  error?: string
}

export function Switch({
  label,
  checked,
  onChange,
  description,
  error
}: SwitchProps): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-white">
      <span className="flex min-w-0 items-center gap-1">
        <span className={`${error ? 'text-primary' : 'text-white/50'}`}>{label}</span>
        {description && (
          <Tooltip label={description}>
            <Icon name="info" className="opacity-50" />
          </Tooltip>
        )}
        {error && (
          <Tooltip type="error" label={error}>
            <Icon name="warning" className="opacity-100 text-primary" />
          </Tooltip>
        )}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span
        aria-hidden
        className={cn(
          'relative flex items-center h-8 w-14 rounded-full border transition',
          checked ? 'bg-primary/50 border-primary' : 'bg-white/10 border-white/10'
        )}
      >
        <span
          className={cn(
            'absolute size-6 bg-white rounded-full transition-all duration-200',
            checked ? 'left-[calc(100%-1.75rem)]' : 'left-1'
          )}
        />
      </span>
    </label>
  )
}
