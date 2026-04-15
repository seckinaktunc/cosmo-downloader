import type { DownloadProgress } from '../../shared/types'

const DOWNLOAD_PROGRESS_PREFIX = 'cosmo-download|'

export function parseProgressNumber(value: string): number | undefined {
  const parsed = Number(value.replace('%', '').trim())
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : undefined
}

function parseBytes(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'NA' || trimmed === 'None') {
    return undefined
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed && trimmed !== 'NA' && trimmed !== 'None' ? trimmed : undefined
}

export function parseYtdlpProgressLine(line: string): Partial<DownloadProgress> | null {
  const trimmed = line.trim()
  const payload = trimmed.startsWith(DOWNLOAD_PROGRESS_PREFIX)
    ? trimmed.slice(DOWNLOAD_PROGRESS_PREFIX.length)
    : trimmed

  const parts = payload.split('|')
  if (parts.length < 5) {
    return null
  }

  const [percent = '', speed = '', eta = '', downloaded = '', total = ''] = parts
  const percentage = parseProgressNumber(percent)
  if (percentage == null) {
    return null
  }

  return {
    percentage,
    speed: parseText(speed),
    eta: parseText(eta),
    downloadedBytes: parseBytes(downloaded),
    totalBytes: parseBytes(total)
  }
}

export type FfmpegProgressParseResult = {
  buffer: string
  progress?: Partial<DownloadProgress>
}

export function parseFfmpegProgressChunk(
  buffer: string,
  chunk: string,
  durationSeconds?: number
): FfmpegProgressParseResult {
  const combined = `${buffer}${chunk}`
  const lines = combined.split(/\r?\n/)
  const nextBuffer = lines.pop() ?? ''
  let outputMs: number | undefined
  let progress: Partial<DownloadProgress> | undefined
  const totalMs = durationSeconds && durationSeconds > 0 ? durationSeconds * 1000 : undefined

  for (const line of lines) {
    const [key, value] = line.split('=')
    if (key === 'out_time_ms') {
      const parsed = Number(value) / 1000
      outputMs = Number.isFinite(parsed) ? parsed : outputMs
      progress = {
        percentage:
          totalMs && outputMs != null
            ? Math.max(0, Math.min(100, (outputMs / totalMs) * 100))
            : undefined
      }
    }

    if (key === 'progress') {
      progress = {
        percentage:
          totalMs && outputMs != null
            ? Math.max(0, Math.min(100, (outputMs / totalMs) * 100))
            : undefined
      }
    }
  }

  return { buffer: nextBuffer, progress }
}

export const YTDLP_PROGRESS_TEMPLATE =
  'download:cosmo-download|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s'
