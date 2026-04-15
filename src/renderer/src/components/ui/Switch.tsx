import { cn } from '../../lib/utils'

type SwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
}

export function Switch({ label, checked, onChange, description }: SwitchProps): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-white/5 px-4 py-3 text-white">
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{label}</span>
        {description ? <span className="text-sm text-white/50">{description}</span> : null}
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
          'relative h-7 w-12 rounded-lg border border-white/10 transition',
          checked ? 'bg-primary' : 'bg-white/10'
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-5 rounded-md bg-white transition',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </span>
    </label>
  )
}
