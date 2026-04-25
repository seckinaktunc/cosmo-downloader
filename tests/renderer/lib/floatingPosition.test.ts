import { describe, expect, it } from 'vitest'
import { computeFloatingPosition } from '@renderer/lib/floatingPosition'

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

  it('returns the tail side for the resolved base placement', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 100, width: 40, height: 20 } },
        size: { width: 120, height: 40 },
        viewport: { width: 300, height: 200 },
        placement: 'top'
      }).tailSide
    ).toBe('bottom')

    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 100, width: 40, height: 20 } },
        size: { width: 120, height: 40 },
        viewport: { width: 300, height: 200 },
        placement: 'right'
      }).tailSide
    ).toBe('left')
  })

  it('centers the tail on the anchor for unclamped top and right placements', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 100, width: 40, height: 20 } },
        size: { width: 120, height: 40 },
        viewport: { width: 320, height: 240 },
        placement: 'top'
      }).tailOffset
    ).toBe(60)

    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 100, width: 40, height: 20 } },
        size: { width: 80, height: 60 },
        viewport: { width: 320, height: 240 },
        placement: 'right'
      }).tailOffset
    ).toBe(30)
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

  it('clamps the tail offset near horizontal and vertical edges', () => {
    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 5, top: 100, width: 20, height: 20 } },
        size: { width: 120, height: 40 },
        viewport: { width: 320, height: 240 },
        placement: 'top'
      }).tailOffset
    ).toBe(12)

    expect(
      computeFloatingPosition({
        anchor: { type: 'rect', rect: { left: 100, top: 5, width: 20, height: 20 } },
        size: { width: 80, height: 60 },
        viewport: { width: 320, height: 240 },
        placement: 'left'
      }).tailOffset
    ).toBe(12)
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

  it('updates the tail side after flipping placement', () => {
    const position = computeFloatingPosition({
      anchor: { type: 'rect', rect: { left: 100, top: 180, width: 40, height: 20 } },
      size: { width: 120, height: 40 },
      viewport: { width: 300, height: 220 },
      placement: 'bottom-start',
      padding: 8
    })

    expect(position.placement).toBe('top-start')
    expect(position.tailSide).toBe('bottom')
  })
})
