import { describe, expect, it } from 'vitest'
import { getLogScrollState } from './logScroll'

describe('getLogScrollState', () => {
  it('hides the scroll button when the viewer is not scrollable', () => {
    expect(
      getLogScrollState({
        scrollHeight: 300,
        scrollTop: 0,
        clientHeight: 300
      })
    ).toEqual({
      nearBottom: true,
      scrollable: false,
      showScrollToBottom: false
    })
  })

  it('hides the scroll button when the viewer is within the bottom threshold', () => {
    expect(
      getLogScrollState({
        scrollHeight: 1000,
        scrollTop: 560,
        clientHeight: 400
      })
    ).toEqual({
      nearBottom: true,
      scrollable: true,
      showScrollToBottom: false
    })
  })

  it('shows the scroll button when the viewer is scrollable and past the bottom threshold', () => {
    expect(
      getLogScrollState({
        scrollHeight: 1000,
        scrollTop: 559,
        clientHeight: 400
      })
    ).toEqual({
      nearBottom: false,
      scrollable: true,
      showScrollToBottom: true
    })
  })
})
