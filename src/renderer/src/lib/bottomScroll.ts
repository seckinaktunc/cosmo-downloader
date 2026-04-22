export const BOTTOM_SCROLL_THRESHOLD = 40

export type BottomScrollMetrics = {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

export type BottomScrollState = {
  nearBottom: boolean
  scrollable: boolean
  showScrollToBottom: boolean
}

export function getBottomScrollState(
  metrics: BottomScrollMetrics,
  threshold = BOTTOM_SCROLL_THRESHOLD
): BottomScrollState {
  const remaining = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
  const nearBottom = remaining <= threshold
  const scrollable = metrics.scrollHeight > metrics.clientHeight

  return {
    nearBottom,
    scrollable,
    showScrollToBottom: scrollable && !nearBottom
  }
}
