import { describe, expect, it } from 'vitest'
import { computeFloatingPosition } from './floatingPosition'

describe('computeFloatingPosition', () => {
  it('clamps left overflow inside the viewport', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'point', point: { x: 1, y: 80 } },
        size: { width: 120, height: 40 },
        viewport: { width: 300, height: 200 },
        padding: 8
      }).left
    ).toBe(8)
  })

  it('clamps right overflow inside the viewport', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'point', point: { x: 295, y: 80 } },
        size: { width: 120, height: 40 },
        viewport: { width: 300, height: 200 },
        padding: 8
      }).left
    ).toBe(172)
  })

  it('flips when the preferred placement overflows the main axis', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 180, width: 40, height: 20 } },
        size: { width: 120, height: 40 },
        viewport: { width: 300, height: 220 },
        placement: 'bottom-start',
        padding: 8
      }).placement
    ).toBe('top-start')
  })

  it('clamps top overflow inside the viewport', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'point', point: { x: 100, y: 2 } },
        size: { width: 120, height: 40 },
        viewport: { width: 300, height: 200 },
        placement: 'top',
        padding: 8
      }).top
    ).toBe(10)
  })

  it('clamps bottom overflow inside the viewport', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 170, width: 40, height: 20 } },
        size: { width: 120, height: 80 },
        viewport: { width: 300, height: 200 },
        placement: 'left-start',
        padding: 8
      }).top
    ).toBe(112)
  })
})
