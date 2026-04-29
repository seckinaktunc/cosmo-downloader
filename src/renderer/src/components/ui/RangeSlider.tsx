import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  formatTimecode,
  normalizeTrimRange,
  parseTimecode,
  TRIM_MIN_LENGTH_SECONDS
} from '../../../../shared/trim'
import { cn } from '../../lib/utils'
import { Tooltip } from './Tooltip'
import Icon from '../miscellaneous/Icon'
import { useTranslation } from 'react-i18next'

type RangeValue = {
  startSeconds: number
  endSeconds: number
}

type RangeSliderProps = {
  label: string
  startLabel: string
  endLabel: string
  value: RangeValue
  max: number
  onChange: (value: RangeValue) => void
  disabled?: boolean
  invalidLabel?: string
}

type DraftInput = {
  field: 'start' | 'end' | null
  text: string
}

type RangeDragState = {
  pointerId: number
  initialClientX: number
  initialStartSeconds: number
  initialEndSeconds: number
  trackWidth: number
}

export function RangeSlider({
  label,
  startLabel,
  endLabel,
  value,
  max,
  onChange,
  disabled = false,
  invalidLabel
}: RangeSliderProps): React.JSX.Element {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const rangeDragRef = useRef<RangeDragState | null>(null)
  const [draft, setDraft] = useState<DraftInput>({ field: null, text: '' })
  const [error, setError] = useState<string | null>(null)
  const [isDraggingRange, setIsDraggingRange] = useState(false)
  const duration = Math.max(0, Math.floor(max))
  const normalized = useMemo(
    () => normalizeTrimRange(value.startSeconds, value.endSeconds, duration),
    [duration, value.endSeconds, value.startSeconds]
  )
  const range = Math.max(1, duration)
  const startPercent = (normalized.startSeconds / range) * 100
  const endPercent = (normalized.endSeconds / range) * 100
  const startText = draft.field === 'start' ? draft.text : formatTimecode(normalized.startSeconds)
  const endText = draft.field === 'end' ? draft.text : formatTimecode(normalized.endSeconds)
  const canDragSelectedRange =
    !disabled &&
    duration > TRIM_MIN_LENGTH_SECONDS &&
    normalized.endSeconds > normalized.startSeconds

  const commitRange = (startSeconds: number, endSeconds: number): void => {
    if (disabled || duration <= 0) {
      return
    }

    setError(null)
    onChange(normalizeTrimRange(startSeconds, endSeconds, duration))
  }

  const commitStartText = (): void => {
    if (disabled || duration <= 0) {
      return
    }

    const parsed = parseTimecode(startText)
    if (parsed == null) {
      setError(invalidLabel ?? null)
      setDraft({ field: null, text: '' })
      return
    }

    const nextRange = normalizeTrimRange(
      Math.min(parsed, normalized.endSeconds - TRIM_MIN_LENGTH_SECONDS),
      normalized.endSeconds,
      duration
    )
    setError(parsed === nextRange.startSeconds ? null : (invalidLabel ?? null))
    onChange(nextRange)
    setDraft({ field: null, text: '' })
  }

  const commitEndText = (): void => {
    if (disabled || duration <= 0) {
      return
    }

    const parsed = parseTimecode(endText)
    if (parsed == null) {
      setError(invalidLabel ?? null)
      setDraft({ field: null, text: '' })
      return
    }

    const nextRange = normalizeTrimRange(
      normalized.startSeconds,
      Math.max(parsed, normalized.startSeconds + TRIM_MIN_LENGTH_SECONDS),
      duration
    )
    setError(parsed === nextRange.endSeconds ? null : (invalidLabel ?? null))
    onChange(nextRange)
    setDraft({ field: null, text: '' })
  }

  const clearRangeDrag = (): void => {
    rangeDragRef.current = null
    setIsDraggingRange(false)
  }

  const handleSelectedRangePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!canDragSelectedRange) {
      return
    }

    const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 0
    if (trackWidth <= 0) {
      return
    }

    rangeDragRef.current = {
      pointerId: event.pointerId,
      initialClientX: event.clientX,
      initialStartSeconds: normalized.startSeconds,
      initialEndSeconds: normalized.endSeconds,
      trackWidth
    }
    setIsDraggingRange(true)
    setError(null)
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSelectedRangePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const dragState = rangeDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const selectedLength = dragState.initialEndSeconds - dragState.initialStartSeconds
    const deltaSeconds = Math.round(
      ((event.clientX - dragState.initialClientX) / dragState.trackWidth) * duration
    )
    const maxStart = Math.max(0, duration - selectedLength)
    const nextStart = Math.max(0, Math.min(maxStart, dragState.initialStartSeconds + deltaSeconds))

    commitRange(nextStart, nextStart + selectedLength)
  }

  const handleSelectedRangePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (rangeDragRef.current?.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    clearRangeDrag()
  }

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-40')}>
      <div className="flex items-center justify-between gap-4">
        <label
          className={cn('flex gap-1 text-sm font-medium text-white/50', error && 'text-primary')}
        >
          {label}
          {error && (
            <Tooltip type="error" label={error}>
              <Icon name="warning" className="opacity-100 text-primary" />
            </Tooltip>
          )}
        </label>
        <span className="text-sm font-bold text-white">
          {normalized.startSeconds === 0 && normalized.endSeconds === max
            ? t('exportSettings.trimFull')
            : `${formatTimecode(normalized.startSeconds)} - ${formatTimecode(normalized.endSeconds)}`}
        </span>
      </div>

      <div ref={trackRef} className="relative h-2">
        <div className="absolute inset-0 rounded-lg bg-white/10" />
        <div
          className={cn(
            'absolute top-0 z-10 h-2 rounded-lg bg-linear-to-r from-primary/50 to-primary',
            canDragSelectedRange
              ? 'touch-none cursor-grab select-none active:cursor-grabbing'
              : 'pointer-events-none',
            isDraggingRange && 'cursor-grabbing'
          )}
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`
          }}
          onPointerDown={handleSelectedRangePointerDown}
          onPointerMove={handleSelectedRangePointerMove}
          onPointerUp={handleSelectedRangePointerUp}
          onPointerCancel={handleSelectedRangePointerUp}
          onLostPointerCapture={clearRangeDrag}
        />
        <input
          aria-label={startLabel}
          type="range"
          min={0}
          max={duration}
          step={1}
          disabled={disabled || duration <= TRIM_MIN_LENGTH_SECONDS}
          value={normalized.startSeconds}
          onChange={(event) =>
            commitRange(
              Math.min(
                Number(event.currentTarget.value),
                normalized.endSeconds - TRIM_MIN_LENGTH_SECONDS
              ),
              normalized.endSeconds
            )
          }
          className={`
            absolute inset-0 h-2 w-full appearance-none bg-transparent pointer-events-none z-20
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:transition-all
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-3.5
            [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:bg-white
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125'}
          `}
        />
        <input
          aria-label={endLabel}
          type="range"
          min={0}
          max={duration}
          step={1}
          disabled={disabled || duration <= TRIM_MIN_LENGTH_SECONDS}
          value={normalized.endSeconds}
          onChange={(event) =>
            commitRange(
              normalized.startSeconds,
              Math.max(
                Number(event.currentTarget.value),
                normalized.startSeconds + TRIM_MIN_LENGTH_SECONDS
              )
            )
          }
          className={`
            absolute inset-0 h-2 w-full appearance-none bg-transparent pointer-events-none z-30
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:transition-all
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-3.5
            [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:bg-white
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125'}
          `}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1 text-[10px] text-white/50">
          {startLabel}
          <input
            aria-label={startLabel}
            type="text"
            value={startText}
            disabled={disabled}
            onFocus={() =>
              setDraft({ field: 'start', text: formatTimecode(normalized.startSeconds) })
            }
            onChange={(event) => setDraft({ field: 'start', text: event.currentTarget.value })}
            onBlur={commitStartText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
            className="py-1 text-[10px] font-medium text-white outline-none transition-colors disabled:cursor-not-allowed"
          />
        </label>
        <label className="flex items-center justify-end gap-1 text-[10px] text-white/50">
          <input
            aria-label={endLabel}
            type="text"
            value={endText}
            disabled={disabled}
            onFocus={() => setDraft({ field: 'end', text: formatTimecode(normalized.endSeconds) })}
            onChange={(event) => setDraft({ field: 'end', text: event.currentTarget.value })}
            onBlur={commitEndText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
            className="py-1 text-[10px] text-right font-medium text-white outline-none transition-colors disabled:cursor-not-allowed"
          />
          {endLabel}
        </label>
      </div>
    </div>
  )
}
