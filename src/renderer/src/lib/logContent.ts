import type { DownloadLogAppend, DownloadLogReadResult } from '../../../shared/types'
import { appendCompactedLogLines } from '../../../shared/logCompaction'

export const LOG_TAIL_BYTES = 256 * 1024

function trimVisibleContent(content: string, maxBytes: number): string {
  return content.length > maxBytes ? content.slice(-maxBytes) : content
}

export function appendLogLines(
  result: DownloadLogReadResult,
  lines: string[],
  maxBytes = LOG_TAIL_BYTES
): DownloadLogReadResult {
  if (lines.length === 0) {
    return result
  }

  const rawChunk = `${lines.join('\n')}\n`
  const untrimmedContent = appendCompactedLogLines(result.content, lines)
  const content = trimVisibleContent(untrimmedContent, maxBytes)

  return {
    ...result,
    content,
    size: result.size + rawChunk.length,
    bytesRead: content.length,
    truncated: result.truncated || untrimmedContent.length > maxBytes,
    updatedAt: new Date().toISOString()
  }
}

export function appendLiveLogLines(
  current: DownloadLogReadResult | null,
  append: DownloadLogAppend,
  activeLogPath: string | null,
  maxBytes = LOG_TAIL_BYTES
): DownloadLogReadResult | null {
  if (append.logPath !== activeLogPath) {
    return current
  }

  const base =
    current?.logPath === append.logPath
      ? current
      : {
          logPath: append.logPath,
          content: '',
          size: 0,
          bytesRead: 0,
          truncated: false
        }

  return appendLogLines(base, append.lines, maxBytes)
}
