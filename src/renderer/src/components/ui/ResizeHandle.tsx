import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject
} from 'react'
import { cn } from '../../lib/utils'
import { calculateResizePercent, clampResizePercent } from '../../lib/resizeMath'

type ResizeHandleProps = {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  containerRef: RefObject<HTMLElement | null>
  label: string
}

export function ResizeHandle({
  value,
  min,
  max,
  onChange,
  containerRef,
  label
}: ResizeHandleProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const pointerOffsetRef = useRef(0)

  const getContainerMetrics = (): {
    contentLeft: number
    contentWidth: number
  } | null => {
    const container = containerRef.current

    if (!container) {
      return null
    }

    const rect = container.getBoundingClientRect()
    const styles = window.getComputedStyle(container)
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0
    const contentLeft = rect.left + paddingLeft
    const contentWidth = rect.width - paddingLeft - paddingRight

    if (contentWidth <= 0) {
      return null
    }

    return { contentLeft, contentWidth }
  }

  const updateFromClientX = (clientX: number): void => {
    const metrics = getContainerMetrics()

    if (!metrics) {
      return
    }

    onChange(
      calculateResizePercent(
        clientX,
        metrics.contentLeft,
        metrics.contentWidth,
        pointerOffsetRef.current,
        min,
        max
      )
    )
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const metrics = getContainerMetrics()
    if (metrics) {
      const dividerX = metrics.contentLeft + (metrics.contentWidth * value) / 100
      pointerOffsetRef.current = event.clientX - dividerX
    } else {
      pointerOffsetRef.current = 0
    }
    setDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragging) {
      updateFromClientX(event.clientX)
    }
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setDragging(false)
    pointerOffsetRef.current = 0
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        onChange(clampResizePercent(value - 1, min, max))
        break
      case 'ArrowRight':
        event.preventDefault()
        onChange(clampResizePercent(value + 1, min, max))
        break
      case 'Home':
        event.preventDefault()
        onChange(min)
        break
      case 'End':
        event.preventDefault()
        onChange(max)
        break
    }
  }

  useEffect(() => {
    if (!dragging) {
      return undefined
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [dragging])

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      className="no-drag group flex h-full cursor-col-resize items-stretch justify-center rounded-lg outline-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
    >
      <span
        className={cn(
          'my-2 w-0.5 rounded-full bg-white/0 transition-colors group-hover:bg-white/40 group-focus-visible:bg-white/70',
          dragging && 'bg-white/70'
        )}
      />
    </div>
  )
}
