import type { DownloadLogAppend, DownloadLogReadResult } from '../../../shared/types'

export const LOG_TAIL_BYTES = 256 * 1024
const FFMPEG_PROGRESS_PREFIX = 'ffmpeg-progress|'
const YTDLP_PROGRESS_PREFIX = 'cosmo-download|'
const FFMPEG_PROGRESS_KEYS = new Set([
  'frame',
  'fps',
  'stream_0_0_q',
  'bitrate',
  'total_size',
  'out_time_us',
  'out_time_ms',
  'out_time',
  'dup_frames',
  'drop_frames',
  'speed',
  'progress'
])

type LiveProgressKind = 'yt-dlp' | 'ffmpeg'

function getLineParts(content: string): string[] {
  if (!content) {
    return []
  }

  const withoutTrailingNewline = content.endsWith('\n') ? content.slice(0, -1) : content
  return withoutTrailingNewline ? withoutTrailingNewline.split('\n') : []
}

function joinLineParts(lines: string[]): string {
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

function getFfmpegProgressField(line: string): [string, string] | null {
  const separatorIndex = line.indexOf('=')
  if (separatorIndex <= 0) {
    return null
  }

  const key = line.slice(0, separatorIndex).trim()
  if (!FFMPEG_PROGRESS_KEYS.has(key)) {
    return null
  }

  return [key, line.slice(separatorIndex + 1).trim()]
}

function getProgressKind(line: string): LiveProgressKind | null {
  const trimmed = line.trim()
  if (trimmed.startsWith(YTDLP_PROGRESS_PREFIX)) {
    return 'yt-dlp'
  }

  if (trimmed.startsWith(FFMPEG_PROGRESS_PREFIX) || getFfmpegProgressField(trimmed)) {
    return 'ffmpeg'
  }

  return null
}

function parseFfmpegProgressDisplay(line: string): Map<string, string> {
  const fields = new Map<string, string>()
  if (!line.startsWith(FFMPEG_PROGRESS_PREFIX)) {
    return fields
  }

  for (const part of line.slice(FFMPEG_PROGRESS_PREFIX.length).split('|')) {
    const field = getFfmpegProgressField(part)
    if (field) {
      fields.set(field[0], field[1])
    }
  }

  return fields
}

function formatFfmpegProgressDisplay(fields: Map<string, string>): string {
  const order = ['frame', 'fps', 'bitrate', 'total_size', 'out_time', 'speed', 'progress']
  const parts = order.flatMap((key) => {
    const value = fields.get(key)
    return value ? [`${key}=${value}`] : []
  })

  return `${FFMPEG_PROGRESS_PREFIX}${parts.join('|')}`
}

function replaceTrailingProgressLine(
  lines: string[],
  kind: LiveProgressKind,
  nextLine: string
): void {
  while (lines.length > 0 && getProgressKind(lines[lines.length - 1]) === kind) {
    lines.pop()
  }

  lines.push(nextLine)
}

function applyLiveLine(content: string, line: string): string {
  const kind = getProgressKind(line)
  if (!kind) {
    const lines = getLineParts(content)
    lines.push(line)
    return joinLineParts(lines)
  }

  const lines = getLineParts(content)
  if (kind === 'yt-dlp') {
    replaceTrailingProgressLine(lines, kind, line)
    return joinLineParts(lines)
  }

  const previousLine = lines[lines.length - 1]
  const fields = parseFfmpegProgressDisplay(previousLine ?? '')
  const field = getFfmpegProgressField(line.trim())
  if (field) {
    fields.set(field[0], field[1])
  }

  replaceTrailingProgressLine(lines, kind, formatFfmpegProgressDisplay(fields))
  return joinLineParts(lines)
}

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
  const untrimmedContent = lines.reduce(
    (current, line) => applyLiveLine(current, line),
    result.content
  )
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
