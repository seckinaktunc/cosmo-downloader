import { cn } from '../../lib/utils'

type RadioBoxesProps<T extends string> = {
  label?: string
  value: T
  options: Array<{ value: T; label: string; disabled?: boolean }>
  className?: string
  onChange: (value: T) => void
}

export function RadioBoxes<T extends string>({
  label,
  value,
  options,
  className,
  onChange
}: RadioBoxesProps<T>): React.JSX.Element {
  return (
    <fieldset className="space-y-2">
      {label && <legend className="text-sm font-medium text-white/60">{label}</legend>}
      <div className={cn('grid grid-cols-5 h-16 gap-2', className)}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center justify-center rounded-sm border px-3 py-2 text-sm font-semibold uppercase transition',
              value === option.value
                ? 'border-white bg-white text-black'
                : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
              option.disabled && 'cursor-not-allowed opacity-40'
            )}
          >
            <input
              type="radio"
              className="sr-only"
              disabled={option.disabled}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
