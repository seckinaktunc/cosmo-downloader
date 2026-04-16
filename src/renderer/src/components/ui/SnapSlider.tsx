import { cn } from '../../lib/utils'

type SliderValue = string | number

type SnapSliderProps<T extends SliderValue> = {
  label: string
  value: T
  options: readonly T[]
  formatLabel: (value: T) => string
  onChange: (value: T) => void
  disabled?: boolean
}

export function SnapSlider<T extends SliderValue>({
  label,
  value,
  options,
  formatLabel,
  onChange,
  disabled = false
}: SnapSliderProps<T>): React.JSX.Element {
  const currentIndex = Math.max(
    0,
    options.findIndex((option) => option === value)
  )
  const maxIndex = Math.max(0, options.length - 1)
  const progress = maxIndex === 0 ? 0 : (currentIndex / maxIndex) * 100

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-40')}>
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-medium text-white/60">{label}</label>
        <span className="text-sm font-bold text-white">{formatLabel(options[currentIndex])}</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, options.length - 1)}
        step={1}
        disabled={disabled || options.length <= 1}
        value={currentIndex}
        onChange={(event) => onChange(options[Number(event.currentTarget.value)])}
        className={`
          w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer z-10
          bg-linear-to-r from-primary/50 to-primary bg-no-repeat
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5 
          [&::-webkit-slider-thumb]:h-3.5 
          [&::-webkit-slider-thumb]:rounded-full 
          [&::-webkit-slider-thumb]:bg-white 
          [&::-webkit-slider-thumb]:transition-all
          hover:[&::-webkit-slider-thumb]:bg-white 
          hover:[&::-webkit-slider-thumb]:scale-125
        `}
        style={{
          backgroundSize: `${progress}% 100%`
        }}
      />
      <div className="relative h-4 w-full text-xs text-white/40">
        {options.map((option, index) => {
          let translateClass = '-translate-x-1/2'

          if (index === 0) translateClass = '-translate-x-0'
          if (index === maxIndex) translateClass = '-translate-x-full'

          return (
            <span
              key={String(option)}
              onClick={() => {
                if (!disabled) {
                  onChange(option)
                }
              }}
              className={`
                absolute flex justify-center text-[10px] text-nowrap pointer-events-auto
                ${option === value ? 'text-white font-medium' : 'text-white/20 hover:text-white/75'}
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                transition-colors ${translateClass}
              `}
              style={{ left: `${maxIndex === 0 ? 0 : (index / maxIndex) * 100}%` }}
            >
              {formatLabel(option)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
