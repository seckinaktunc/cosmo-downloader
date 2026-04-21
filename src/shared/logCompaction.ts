export const FFMPEG_PROGRESS_PREFIX = 'ffmpeg-progress|'
export const YTDLP_PROGRESS_PREFIX = 'cosmo-download|'

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

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const withoutTrailingNewline = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
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

function appendCompactedLine(lines: string[], line: string): void {
  const kind = getProgressKind(line)
  if (!kind) {
    lines.push(line)
    return
  }

  if (kind === 'yt-dlp') {
    replaceTrailingProgressLine(lines, kind, line)
    return
  }

  const previousLine = lines[lines.length - 1]
  const fields = parseFfmpegProgressDisplay(previousLine ?? '')
  const field = getFfmpegProgressField(line.trim())
  if (field) {
    fields.set(field[0], field[1])
  }

  replaceTrailingProgressLine(lines, kind, formatFfmpegProgressDisplay(fields))
}

export function appendCompactedLogLines(content: string, lines: string[]): string {
  const compactedLines = getLineParts(content)
  for (const line of lines) {
    appendCompactedLine(compactedLines, line)
  }

  return joinLineParts(compactedLines)
}

export function compactLogContent(content: string): string {
  return appendCompactedLogLines('', getLineParts(content))
}
