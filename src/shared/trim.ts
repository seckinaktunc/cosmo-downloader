import type { ExportSettings } from './types'

export const TRIM_MIN_LENGTH_SECONDS = 1

export type NormalizedTrimRange = {
  startSeconds: number
  endSeconds: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toWholeSeconds(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
}

export function normalizeTrimRange(
  startSeconds: unknown,
  endSeconds: unknown,
  durationSeconds: number,
  minLengthSeconds = TRIM_MIN_LENGTH_SECONDS
): NormalizedTrimRange {
  const duration = Math.max(0, Math.floor(durationSeconds))
  if (duration <= 0) {
    return { startSeconds: 0, endSeconds: 0 }
  }

  const minLength = Math.min(Math.max(1, Math.floor(minLengthSeconds)), duration)
  const maxStart = Math.max(0, duration - minLength)
  let start = clamp(toWholeSeconds(startSeconds, 0), 0, maxStart)
  let end = clamp(toWholeSeconds(endSeconds, duration), minLength, duration)

  if (end - start < minLength) {
    if (start + minLength <= duration) {
      end = start + minLength
    } else {
      start = Math.max(0, end - minLength)
    }
  }

  return { startSeconds: start, endSeconds: end }
}

export function isTrimActive(settings: ExportSettings, durationSeconds?: number): boolean {
  if (durationSeconds == null || durationSeconds <= 0) {
    return false
  }

  const range = normalizeTrimRange(
    settings.trimStartSeconds,
    settings.trimEndSeconds,
    durationSeconds
  )

  return range.startSeconds > 0 || range.endSeconds < Math.floor(durationSeconds)
}

export function formatTimecode(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`
  }

  return `${minutes}:${pad(remainingSeconds)}`
}

export function parseTimecode(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.startsWith('-')) {
    return null
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  const parts = trimmed.split(':')
  if (parts.length !== 2 && parts.length !== 3) {
    return null
  }

  if (!parts.every((part) => /^\d+$/.test(part))) {
    return null
  }

  const values = parts.map(Number)
  const seconds = values[values.length - 1]
  const minutes = values[values.length - 2]
  const hours = values.length === 3 ? values[0] : 0

  if (minutes > 59 || seconds > 59) {
    return null
  }

  return hours * 3600 + minutes * 60 + seconds
}
