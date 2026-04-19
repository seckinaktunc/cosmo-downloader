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
  type?: 'default' | 'error'
  children: ReactNode
  placement?: FloatingPlacement
}

export function Tooltip({
  label,
  type = 'default',
  children,
  placement = 'top'
}: TooltipProps): React.JSX.Element {
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
              className={`
              pointer-events-none fixed z-50 inline-block
        w-fit max-w-[min(28rem,calc(100vw-1rem))]
        whitespace-normal wrap-break-word text-center
        rounded-md border ${type === 'default' ? 'border-white/10 bg-gray text-white/50' : 'border-primary/50 bg-primary/25 text-primary'}
        px-3 py-2 text-sm shadow-lg backdrop-blur-lg
              `}
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
