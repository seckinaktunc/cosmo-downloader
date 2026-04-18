import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Icon, { type IconName } from '../miscellaneous/Icon'
import { cn } from '../../lib/utils'

export type DropdownOption<T extends string> = {
  value: T
  label: string
  icon?: IconName
  disabled?: boolean
}

type DropdownProps<T extends string> = {
  value: T
  options: Array<DropdownOption<T>>
  onChange: (value: T) => void
  ariaLabelledBy?: string
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabelledBy
}: DropdownProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  )
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const getOptionId = (index: number): string => `${listboxId}-option-${index}`

  const findEnabledIndex = (startIndex: number, direction: 1 | -1): number => {
    if (options.length === 0) {
      return -1
    }

    let index = startIndex
    for (let step = 0; step < options.length; step += 1) {
      const normalizedIndex = (index + options.length) % options.length
      if (!options[normalizedIndex].disabled) {
        return normalizedIndex
      }
      index += direction
    }

    return -1
  }

  const getInitialFocusIndex = (): number => {
    if (selectedIndex >= 0 && !options[selectedIndex].disabled) {
      return selectedIndex
    }

    return findEnabledIndex(0, 1)
  }

  const openDropdown = (): void => {
    setOpen(true)
    setFocusedIndex(getInitialFocusIndex())
  }

  const closeDropdown = (): void => {
    setOpen(false)
    setFocusedIndex(-1)
  }

  const selectOption = (option: DropdownOption<T>): void => {
    if (option.disabled) {
      return
    }

    onChange(option.value)
    closeDropdown()
  }

  const moveFocus = (direction: 1 | -1): void => {
    const startIndex = focusedIndex >= 0 ? focusedIndex + direction : getInitialFocusIndex()
    setFocusedIndex(findEnabledIndex(startIndex, direction))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) {
          openDropdown()
          return
        }
        moveFocus(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) {
          openDropdown()
          return
        }
        moveFocus(-1)
        break
      case 'Home':
        if (open) {
          event.preventDefault()
          setFocusedIndex(findEnabledIndex(0, 1))
        }
        break
      case 'End':
        if (open) {
          event.preventDefault()
          setFocusedIndex(findEnabledIndex(options.length - 1, -1))
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!open) {
          openDropdown()
          return
        }
        if (focusedIndex >= 0) {
          selectOption(options[focusedIndex])
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          closeDropdown()
        }
        break
    }
  }

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleDocumentMouseDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledBy}
        aria-activedescendant={open && focusedIndex >= 0 ? getOptionId(focusedIndex) : undefined}
        className="no-drag flex w-full items-center min-w-40 h-10 justify-between gap-3 border border-white/10 bg-dark p-2 text-left text-white outline-none transition hover:border-white/20 focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleKeyDown}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption?.icon ? (
            <Icon name={selectedOption.icon} size={18} className="shrink-0 text-white/70" />
          ) : null}
          <span className="truncate">{selectedOption?.label ?? value}</span>
        </span>
        <Icon
          name="chevronDown"
          size={18}
          className={cn('shrink-0 text-white/50 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          className="no-drag absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto border border-white/10 bg-dark shadow-2xl shadow-black/40"
        >
          {options.map((option, index) => {
            const selected = option.value === value
            const focused = index === focusedIndex

            return (
              <div
                id={getOptionId(index)}
                key={option.value}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-3 px-2 py-2 text-left text-sm text-white/80',
                  focused && 'bg-white/10 text-white',
                  selected && 'text-white',
                  option.disabled && 'cursor-not-allowed opacity-40'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setFocusedIndex(index)
                  }
                }}
                onClick={() => selectOption(option)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.icon ? (
                    <Icon name={option.icon} size={18} className="shrink-0 text-white/70" />
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </span>
                {selected ? <Icon name="check" size={16} className="shrink-0 text-white" /> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
