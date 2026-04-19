export function clampResizePercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function calculateResizePercent(
  clientX: number,
  contentLeft: number,
  contentWidth: number,
  pointerOffset: number,
  min: number,
  max: number
): number {
  if (contentWidth <= 0) {
    return min
  }

  return clampResizePercent(
    ((clientX - pointerOffset - contentLeft) / contentWidth) * 100,
    min,
    max
  )
}
