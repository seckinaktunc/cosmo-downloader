import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  computeFloatingPosition,
  DEFAULT_FLOATING_OFFSET,
  type FloatingPlacement,
  type FloatingPosition,
  type FloatingTailSide
} from '../../lib/floatingPosition'
import type { CSSProperties, ReactNode } from 'react'

const TAIL_SIZE_PX = 12
const TAIL_PROTRUSION_PX = TAIL_SIZE_PX / Math.SQRT2
const TAIL_BOUNDING_BOX_PX = TAIL_SIZE_PX * Math.SQRT2
const TAIL_JOIN_OVERLAP_PX = 1
const TAIL_BRIDGE_THICKNESS_PX = 2
const TOOLTIP_BODY_OFFSET_PX = DEFAULT_FLOATING_OFFSET + TAIL_PROTRUSION_PX

function getTailContainerStyle(side: FloatingTailSide, offset: number): CSSProperties {
  if (side === 'top') {
    return {
      left: offset - TAIL_BOUNDING_BOX_PX / 2,
      bottom: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
      width: TAIL_BOUNDING_BOX_PX,
      height: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX
    }
  }

  if (side === 'bottom') {
    return {
      left: offset - TAIL_BOUNDING_BOX_PX / 2,
      top: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
      width: TAIL_BOUNDING_BOX_PX,
      height: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX
    }
  }

  if (side === 'left') {
    return {
      right: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
      top: offset - TAIL_BOUNDING_BOX_PX / 2,
      width: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX,
      height: TAIL_BOUNDING_BOX_PX
    }
  }

  return {
    left: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
    top: offset - TAIL_BOUNDING_BOX_PX / 2,
    width: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX,
    height: TAIL_BOUNDING_BOX_PX
  }
}

function getTailDiamondStyle(side: FloatingTailSide): CSSProperties {
  if (side === 'top') {
    return {
      left: '50%',
      top: '100%',
      width: TAIL_SIZE_PX,
      height: TAIL_SIZE_PX,
      transform: 'translate(-50%, -50%) rotate(45deg)'
    }
  }

  if (side === 'bottom') {
    return {
      left: '50%',
      top: 0,
      width: TAIL_SIZE_PX,
      height: TAIL_SIZE_PX,
      transform: 'translate(-50%, -50%) rotate(45deg)'
    }
  }

  if (side === 'left') {
    return {
      left: '100%',
      top: '50%',
      width: TAIL_SIZE_PX,
      height: TAIL_SIZE_PX,
      transform: 'translate(-50%, -50%) rotate(45deg)'
    }
  }

  return {
    left: 0,
    top: '50%',
    width: TAIL_SIZE_PX,
    height: TAIL_SIZE_PX,
    transform: 'translate(-50%, -50%) rotate(45deg)'
  }
}

function getTailBridgeStyle(side: FloatingTailSide, offset: number): CSSProperties {
  if (side === 'top') {
    return {
      left: offset - TAIL_SIZE_PX / 2,
      top: -1,
      width: TAIL_SIZE_PX,
      height: TAIL_BRIDGE_THICKNESS_PX
    }
  }

  if (side === 'bottom') {
    return {
      left: offset - TAIL_SIZE_PX / 2,
      bottom: -1,
      width: TAIL_SIZE_PX,
      height: TAIL_BRIDGE_THICKNESS_PX
    }
  }

  if (side === 'left') {
    return {
      left: -1,
      top: offset - TAIL_SIZE_PX / 2,
      width: TAIL_BRIDGE_THICKNESS_PX,
      height: TAIL_SIZE_PX
    }
  }

  return {
    right: -1,
    top: offset - TAIL_SIZE_PX / 2,
    width: TAIL_BRIDGE_THICKNESS_PX,
    height: TAIL_SIZE_PX
  }
}

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
        placement,
        offset: TOOLTIP_BODY_OFFSET_PX
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
            role="tooltip"
            className="pointer-events-none fixed z-50 inline-block"
            style={{
              left: position?.left ?? -9999,
              top: position?.top ?? -9999,
              visibility: position ? 'visible' : 'hidden'
            }}
            data-placement={position?.placement}
          >
            {position ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute z-20 overflow-hidden"
                style={getTailContainerStyle(position.tailSide, position.tailOffset)}
              >
                <span
                  className={`absolute border ${type === 'default' ? 'border-white/10 bg-dark' : 'border-primary/50 bg-primary/25'}`}
                  style={getTailDiamondStyle(position.tailSide)}
                />
              </span>
            ) : null}
            <span
              ref={tooltipRef}
              className={`
              relative z-10 inline-block
        w-fit max-w-[min(28rem,calc(100vw-1rem))]
        whitespace-normal wrap-break-word text-center
        rounded-md border ${type === 'default' ? 'border-white/10 bg-dark text-white/50' : 'border-primary/50 bg-primary/25 text-primary'}
        px-3 py-2 text-sm shadow-lg backdrop-blur-lg
                `}
            >
              {label}
              {position ? (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute z-30 ${type === 'default' ? 'bg-dark' : 'bg-primary/25'} backdrop-blur-lg`}
                  style={getTailBridgeStyle(position.tailSide, position.tailOffset)}
                />
              ) : null}
            </span>
          </span>,
          document.body
        )
        : null}
    </span>
  )
}
