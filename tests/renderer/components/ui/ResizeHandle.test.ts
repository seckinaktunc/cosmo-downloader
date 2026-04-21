import { describe, expect, it } from 'vitest'
import { calculateResizePercent } from '@renderer/lib/resizeMath'

describe('calculateResizePercent', () => {
  it('preserves the initial pointer offset from the divider while dragging', () => {
    expect(calculateResizePercent(412, 100, 1000, 12, 30, 50)).toBe(30)
    expect(calculateResizePercent(512, 100, 1000, 12, 30, 50)).toBe(40)
  })

  it('clamps the resized width to the configured bounds', () => {
    expect(calculateResizePercent(0, 100, 1000, 0, 30, 50)).toBe(30)
    expect(calculateResizePercent(900, 100, 1000, 0, 30, 50)).toBe(50)
  })
})
