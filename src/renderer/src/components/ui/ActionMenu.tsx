import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { createPortal } from 'react-dom'
import Icon, { type IconName } from '../miscellaneous/Icon'
import {
  computeFloatingPosition,
  type FloatingAnchor,
  type FloatingPlacement,
  type FloatingPosition
} from '../../lib/floatingPosition'
import { cn } from '../../lib/utils'

export type ActionMenuItem = {
  id: string
  label: string
  icon?: IconName
  disabled?: boolean
  danger?: boolean
  onSelect: () => void | Promise<void>
}

export type ActionMenuAnchor =
  | {
      type: 'element'
      element: HTMLElement
    }
  | {
      type: 'point'
      x: number
      y: number
    }

type ActionMenuProps = {
  open: boolean
  anchor: ActionMenuAnchor | null
  items: ActionMenuItem[]
  onClose: () => void
  placement?: FloatingPlacement
  ariaLabel?: string
  className?: string
}

function rectToAnchor(rect: DOMRect): FloatingAnchor {
  return {
    type: 'rect',
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }
  }
}

function resolveAnchor(anchor: ActionMenuAnchor): FloatingAnchor {
  if (anchor.type === 'point') {
    return { type: 'point', point: { x: anchor.x, y: anchor.y } }
  }

  return rectToAnchor(anchor.element.getBoundingClientRect())
}

function getEnabledMenuItems(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).filter(
    (item) => !item.disabled
  )
}

export function ActionMenu({
  open,
  anchor,
  items,
  onClose,
  placement = 'right-start',
  ariaLabel = 'Actions',
  className
}: ActionMenuProps): React.JSX.Element | null {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<FloatingPosition | null>(null)
  const visibleItems = items.filter((item) => item.id && item.label)

  const updatePosition = useCallback((): void => {
    const root = rootRef.current
    if (!anchor || !root) {
      return
    }

    const rect = root.getBoundingClientRect()
    setPosition(
      computeFloatingPosition({
        anchor: resolveAnchor(anchor),
        size: { width: rect.width, height: rect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        placement
      })
    )
  }, [anchor, placement])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    updatePosition()
  }, [open, updatePosition, visibleItems.length])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleResize = (): void => updatePosition()
    const handleScroll = (): void => updatePosition()

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updatePosition()
          })
    if (rootRef.current && observer) {
      observer.observe(rootRef.current)
    }

    const firstEnabledItem = rootRef.current
      ? getEnabledMenuItems(rootRef.current).at(0)
      : undefined
    firstEnabledItem?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
      observer?.disconnect()
    }
  }, [open, onClose, updatePosition])

  if (!open || !anchor || visibleItems.length === 0) {
    return null
  }

  const style: CSSProperties = {
    left: position?.left ?? -9999,
    top: position?.top ?? -9999,
    visibility: position ? 'visible' : 'hidden'
  }

  const menu = (
    <div
      ref={rootRef}
      className={cn(
        'fixed z-50 min-w-36 overflow-hidden border border-white/10 bg-dark shadow-2xl shadow-black/40',
        className
      )}
      style={style}
      role="menu"
      aria-label={ariaLabel}
      data-placement={position?.placement}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()

        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
          return
        }

        if (!rootRef.current || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
          return
        }

        event.preventDefault()
        const menuItems = getEnabledMenuItems(rootRef.current)
        if (menuItems.length === 0) {
          return
        }

        const currentIndex = menuItems.findIndex((item) => item === document.activeElement)
        const offset = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex =
          currentIndex < 0 ? 0 : (currentIndex + offset + menuItems.length) % menuItems.length
        menuItems[nextIndex].focus()
      }}
    >
      {visibleItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 outline-none hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white disabled:cursor-not-allowed disabled:opacity-40',
            item.danger && 'text-red-300 hover:text-red-200 focus:text-red-200'
          )}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              void item.onSelect()
              onClose()
            }
          }}
        >
          {item.icon ? <Icon name={item.icon} size={16} /> : null}
          <span className="min-w-0 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  )

  return createPortal(menu, document.body)
}
