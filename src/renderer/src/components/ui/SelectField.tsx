import { useId } from 'react'
import { Dropdown, type DropdownOption } from './Dropdown'

type SelectFieldProps<T extends string> = {
  label: string
  value: T
  options: Array<DropdownOption<T>>
  onChange: (value: T) => void
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: SelectFieldProps<T>): React.JSX.Element {
  const labelId = useId()

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium text-white/60">
        {label}
      </span>
      <Dropdown value={value} options={options} onChange={onChange} ariaLabelledBy={labelId} />
    </div>
  )
}
