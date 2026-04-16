export type FloatingPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end'

export type FloatingRect = {
  left: number
  top: number
  width: number
  height: number
}

export type FloatingPoint = {
  x: number
  y: number
}

export type FloatingAnchor =
  | {
      type: 'rect'
      rect: FloatingRect
    }
  | {
      type: 'point'
      point: FloatingPoint
    }

export type FloatingSize = {
  width: number
  height: number
}

export type FloatingViewport = {
  width: number
  height: number
}

export type FloatingPosition = {
  left: number
  top: number
  placement: FloatingPlacement
}

type BasePlacement = 'top' | 'bottom' | 'left' | 'right'
type Alignment = 'center' | 'start' | 'end'

const DEFAULT_PADDING = 8
const DEFAULT_OFFSET = 8

function getBasePlacement(placement: FloatingPlacement): BasePlacement {
  return placement.split('-')[0] as BasePlacement
}

function getAlignment(placement: FloatingPlacement): Alignment {
  const alignment = placement.split('-')[1]
  return alignment === 'start' || alignment === 'end' ? alignment : 'center'
}

function getOppositePlacement(placement: FloatingPlacement): FloatingPlacement {
  const alignment = placement.includes('-') ? `-${placement.split('-')[1]}` : ''
  const base = getBasePlacement(placement)

  if (base === 'top') return `bottom${alignment}` as FloatingPlacement
  if (base === 'bottom') return `top${alignment}` as FloatingPlacement
  if (base === 'left') return `right${alignment}` as FloatingPlacement
  return `left${alignment}` as FloatingPlacement
}

function normalizeAnchor(anchor: FloatingAnchor): FloatingRect {
  if (anchor.type === 'rect') {
    return anchor.rect
  }

  return {
    left: anchor.point.x,
    top: anchor.point.y,
    width: 0,
    height: 0
  }
}

function calculateRawPosition(
  rect: FloatingRect,
  size: FloatingSize,
  placement: FloatingPlacement,
  offset: number
): Pick<FloatingPosition, 'left' | 'top'> {
  const base = getBasePlacement(placement)
  const alignment = getAlignment(placement)
  const rectRight = rect.left + rect.width
  const rectBottom = rect.top + rect.height
  let left = rect.left
  let top = rect.top

  if (base === 'top' || base === 'bottom') {
    top = base === 'top' ? rect.top - size.height - offset : rectBottom + offset

    if (alignment === 'start') {
      left = rect.left
    } else if (alignment === 'end') {
      left = rectRight - size.width
    } else {
      left = rect.left + rect.width / 2 - size.width / 2
    }
  } else {
    left = base === 'left' ? rect.left - size.width - offset : rectRight + offset

    if (alignment === 'start') {
      top = rect.top
    } else if (alignment === 'end') {
      top = rectBottom - size.height
    } else {
      top = rect.top + rect.height / 2 - size.height / 2
    }
  }

  return { left, top }
}

function overflowsMainAxis(
  position: Pick<FloatingPosition, 'left' | 'top'>,
  placement: FloatingPlacement,
  size: FloatingSize,
  viewport: FloatingViewport,
  padding: number
): boolean {
  const base = getBasePlacement(placement)
  if (base === 'top') return position.top < padding
  if (base === 'bottom') return position.top + size.height > viewport.height - padding
  if (base === 'left') return position.left < padding
  return position.left + size.width > viewport.width - padding
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

export function computeFloatingPosition({
  anchor,
  size,
  viewport,
  placement = 'bottom-start',
  offset = DEFAULT_OFFSET,
  padding = DEFAULT_PADDING
}: {
  anchor: FloatingAnchor
  size: FloatingSize
  viewport: FloatingViewport
  placement?: FloatingPlacement
  offset?: number
  padding?: number
}): FloatingPosition {
  const rect = normalizeAnchor(anchor)
  let resolvedPlacement = placement
  let position = calculateRawPosition(rect, size, resolvedPlacement, offset)

  if (overflowsMainAxis(position, resolvedPlacement, size, viewport, padding)) {
    const flippedPlacement = getOppositePlacement(resolvedPlacement)
    const flippedPosition = calculateRawPosition(rect, size, flippedPlacement, offset)
    if (!overflowsMainAxis(flippedPosition, flippedPlacement, size, viewport, padding)) {
      resolvedPlacement = flippedPlacement
      position = flippedPosition
    }
  }

  return {
    left: clamp(position.left, padding, viewport.width - size.width - padding),
    top: clamp(position.top, padding, viewport.height - size.height - padding),
    placement: resolvedPlacement
  }
}
