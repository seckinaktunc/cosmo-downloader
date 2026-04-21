export const LOG_BOTTOM_FOLLOW_THRESHOLD = 40

export type LogScrollMetrics = {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

export type LogScrollState = {
  nearBottom: boolean
  scrollable: boolean
  showScrollToBottom: boolean
}

export function getLogScrollState(
  metrics: LogScrollMetrics,
  threshold = LOG_BOTTOM_FOLLOW_THRESHOLD
): LogScrollState {
  const remaining = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
  const nearBottom = remaining <= threshold
  const scrollable = metrics.scrollHeight > metrics.clientHeight

  return {
    nearBottom,
    scrollable,
    showScrollToBottom: scrollable && !nearBottom
  }
}
