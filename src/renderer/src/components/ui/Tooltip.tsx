import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  computeFloatingPosition,
  DEFAULT_FLOATING_OFFSET,
  type FloatingPlacement,
  type FloatingPosition,
  type FloatingTailSide
} from '../../lib/floatingPosition';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@renderer/lib/utils';

const TAIL_SIZE_PX = 12;
const TAIL_PROTRUSION_PX = TAIL_SIZE_PX / Math.SQRT2;
const TAIL_BOUNDING_BOX_PX = TAIL_SIZE_PX * Math.SQRT2;
const TAIL_JOIN_OVERLAP_PX = 1;
const TAIL_BRIDGE_THICKNESS_PX = 4;

function getTailContainerStyle(side: FloatingTailSide, offset: number): CSSProperties {
  if (side === 'top') {
    return {
      left: offset - TAIL_BOUNDING_BOX_PX / 2,
      bottom: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
      width: TAIL_BOUNDING_BOX_PX,
      height: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX
    };
  }

  if (side === 'bottom') {
    return {
      left: offset - TAIL_BOUNDING_BOX_PX / 2,
      top: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
      width: TAIL_BOUNDING_BOX_PX,
      height: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX
    };
  }

  if (side === 'left') {
    return {
      right: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
      top: offset - TAIL_BOUNDING_BOX_PX / 2,
      width: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX,
      height: TAIL_BOUNDING_BOX_PX
    };
  }

  return {
    left: `calc(100% - ${TAIL_JOIN_OVERLAP_PX}px)`,
    top: offset - TAIL_BOUNDING_BOX_PX / 2,
    width: TAIL_PROTRUSION_PX + TAIL_JOIN_OVERLAP_PX,
    height: TAIL_BOUNDING_BOX_PX
  };
}

function getTailDiamondStyle(side: FloatingTailSide): CSSProperties {
  if (side === 'top') {
    return {
      left: '50%',
      top: '100%',
      width: TAIL_SIZE_PX,
      height: TAIL_SIZE_PX,
      transform: 'translate(-50%, -50%) rotate(45deg)'
    };
  }

  if (side === 'bottom') {
    return {
      left: '50%',
      top: 0,
      width: TAIL_SIZE_PX,
      height: TAIL_SIZE_PX,
      transform: 'translate(-50%, -50%) rotate(45deg)'
    };
  }

  if (side === 'left') {
    return {
      left: '100%',
      top: '50%',
      width: TAIL_SIZE_PX,
      height: TAIL_SIZE_PX,
      transform: 'translate(-50%, -50%) rotate(45deg)'
    };
  }

  return {
    left: 0,
    top: '50%',
    width: TAIL_SIZE_PX,
    height: TAIL_SIZE_PX,
    transform: 'translate(-50%, -50%) rotate(45deg)'
  };
}

function getTailBridgeStyle(side: FloatingTailSide, offset: number): CSSProperties {
  if (side === 'top') {
    return {
      left: offset - TAIL_SIZE_PX / 2,
      top: -TAIL_JOIN_OVERLAP_PX,
      width: TAIL_SIZE_PX,
      height: TAIL_BRIDGE_THICKNESS_PX
    };
  }

  if (side === 'bottom') {
    return {
      left: offset - TAIL_SIZE_PX / 2,
      bottom: -TAIL_JOIN_OVERLAP_PX,
      width: TAIL_SIZE_PX,
      height: TAIL_BRIDGE_THICKNESS_PX
    };
  }

  if (side === 'left') {
    return {
      left: -TAIL_JOIN_OVERLAP_PX,
      top: offset - TAIL_SIZE_PX / 2,
      width: TAIL_BRIDGE_THICKNESS_PX,
      height: TAIL_SIZE_PX
    };
  }

  return {
    right: -TAIL_JOIN_OVERLAP_PX,
    top: offset - TAIL_SIZE_PX / 2,
    width: TAIL_BRIDGE_THICKNESS_PX,
    height: TAIL_SIZE_PX
  };
}

type TooltipProps = {
  open?: boolean;
  label?: string;
  type?: 'default' | 'error';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  placement?: FloatingPlacement;
};

export function Tooltip({
  open = false,
  label,
  type = 'default',
  className,
  style,
  children,
  placement = 'top'
}: TooltipProps): React.JSX.Element {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const isOpen = visible || open;

  const updatePosition = useCallback((): void => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const nextPosition = computeFloatingPosition({
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
      offset: DEFAULT_FLOATING_OFFSET + TAIL_PROTRUSION_PX
    });

    setPosition((current) => {
      if (
        current &&
        current.left === nextPosition.left &&
        current.top === nextPosition.top &&
        current.placement === nextPosition.placement &&
        current.tailSide === nextPosition.tailSide &&
        current.tailOffset === nextPosition.tailOffset
      ) {
        return current;
      }

      return nextPosition;
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (isOpen && label) {
      updatePosition();
    }
  }, [isOpen, label, updatePosition]);

  useEffect(() => {
    if (!isOpen || !label) {
      return undefined;
    }

    const handleUpdate = (): void => updatePosition();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleUpdate);
    if (tooltipRef.current && observer) {
      observer.observe(tooltipRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      observer?.disconnect();
    };
  }, [isOpen, label, updatePosition]);

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex', className)}
      aria-describedby={isOpen && label ? tooltipId : undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      style={style}
    >
      {children}
      {isOpen && label
        ? createPortal(
            <div
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
                    className={cn(
                      'absolute border',
                      type === 'default' && 'border-white/10 bg-dark',
                      type === 'error' && 'border-primary/50 bg-primary/25'
                    )}
                    style={getTailDiamondStyle(position.tailSide)}
                  />
                </span>
              ) : null}
              <div
                ref={tooltipRef}
                className={cn(
                  `
                    relative z-10 inline-block
                    w-fit max-w-[min(28rem,calc(100vw-1rem))]
                    whitespace-normal wrap-break-word text-center
                    rounded-md border text-sm shadow-lg backdrop-blur-lg
                  `,
                  type === 'default' && 'border-white/10 bg-dark text-white/50',
                  type === 'error' && 'border-primary/50 bg-primary/25 text-primary',
                  'px-3 py-2'
                )}
              >
                {label}
                {position ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute backdrop-blur-lg z-30',
                      type === 'default' && 'bg-dark',
                      type === 'error' && 'bg-primary/25'
                    )}
                    style={getTailBridgeStyle(position.tailSide, position.tailOffset)}
                  />
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
