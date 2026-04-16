import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  computeFloatingPosition,
  type FloatingPlacement,
  type FloatingPosition
} from '../../lib/floatingPosition'
import type { ReactNode } from 'react'

type TooltipProps = {
  label: string
  children: ReactNode
  placement?: FloatingPlacement
}

export function Tooltip({ label, children, placement = 'top' }: TooltipProps): React.JSX.Element {
  const tooltipId = useId()
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const tooltipRef = useRef<HTMLSpanElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<FloatingPosition | null>(null)

  const updatePosition = useCallback((): void => {
    const anchor = anchorRef.current
    const tooltip = tooltipRef.current
    if (!anchor || !tooltip) {
      return
    }

    const anchorRect = anchor.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    setPosition(
      computeFloatingPosition({
        anchor: {
          type: 'rect',
          rect: {
            left: anchorRect.left,
            top: anchorRect.top,
            width: anchorRect.width,
            height: anchorRect.height
          }
        },
        size: { width: tooltipRect.width, height: tooltipRect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        placement
      })
    )
  }, [placement])

  useLayoutEffect(() => {
    if (visible) {
      updatePosition()
    }
  }, [label, updatePosition, visible])

  useEffect(() => {
    if (!visible) {
      return undefined
    }

    const handleUpdate = (): void => updatePosition()
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleUpdate)
    if (tooltipRef.current && observer) {
      observer.observe(tooltipRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
      observer?.disconnect()
    }
  }, [updatePosition, visible])

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible
        ? createPortal(
            <span
              id={tooltipId}
              ref={tooltipRef}
              role="tooltip"
              className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs text-black shadow-lg"
              style={{
                left: position?.left ?? -9999,
                top: position?.top ?? -9999,
                visibility: position ? 'visible' : 'hidden'
              }}
              data-placement={position?.placement}
            >
              {label}
            </span>,
            document.body
          )
        : null}
    </span>
  )
}
