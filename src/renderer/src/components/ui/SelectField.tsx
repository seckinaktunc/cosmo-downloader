import { useId } from 'react'
import { Dropdown, type DropdownOption } from './Dropdown'
import { Tooltip } from './Tooltip'
import Icon from '../miscellaneous/Icon'

type SelectFieldProps<T extends string> = {
  label: string
  description?: string
  error?: string
  orientation?: 'horizontal' | 'vertical'
  value: T
  options: Array<DropdownOption<T>>
  onChange: (value: T) => void
}

export function SelectField<T extends string>({
  label,
  description,
  error,
  orientation = 'horizontal',
  value,
  options,
  onChange
}: SelectFieldProps<T>): React.JSX.Element {
  const labelId = useId()

  return (
    <div
      className={`flex ${orientation === 'horizontal' ? 'flex-row items-center justify-between' : 'flex-col'} gap-1`}
    >
      <div className="flex gap-1">
        <span id={labelId} className={`text-white/50 ${orientation === 'vertical' && 'text-sm'}`}>
          {label}
        </span>

        {description && (
          <Tooltip label={description}>
            <Icon name="info" className="opacity-50" />
          </Tooltip>
        )}
        {error && (
          <Tooltip label={error}>
            <Icon name="warning" className="opacity-100 text-primary" />
          </Tooltip>
        )}
      </div>
      <Dropdown value={value} options={options} onChange={onChange} ariaLabelledBy={labelId} />
    </div>
  )
}
