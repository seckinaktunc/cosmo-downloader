import type { OutputFormat } from '../../../shared/types'

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function getLastSeparatorIndex(filePath: string): number {
  return Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
}

function getSeparator(filePath: string): '/' | '\\' {
  return filePath.lastIndexOf('\\') > filePath.lastIndexOf('/') ? '\\' : '/'
}

export function sanitizeOutputFilename(input: string, fallback = 'video'): string {
  const withoutIllegalCharacters = Array.from(input)
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || /[<>:"/\\|?*]/.test(character) ? ' ' : character
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  const sanitized = withoutIllegalCharacters.length > 0 ? withoutIllegalCharacters : fallback
  if (WINDOWS_RESERVED_NAMES.test(sanitized)) {
    return `_${sanitized}`
  }

  return sanitized.slice(0, 180)
}

export function getOutputDirectory(filePath?: string): string | undefined {
  if (!filePath) {
    return undefined
  }

  const trimmed = filePath.trim()
  const separatorIndex = getLastSeparatorIndex(trimmed)
  if (separatorIndex < 0) {
    return undefined
  }

  if (separatorIndex === 0) {
    return trimmed[0]
  }

  return trimmed.slice(0, separatorIndex)
}

export function buildOutputPath(
  directory: string,
  title: string,
  outputFormat: OutputFormat
): string {
  const trimmedDirectory = directory.trim()
  const separator = getSeparator(trimmedDirectory)
  const withoutTrailingSeparator = trimmedDirectory.replace(/[\\/]+$/g, '')
  const normalizedDirectory =
    withoutTrailingSeparator.length > 0 ? withoutTrailingSeparator : separator

  if (normalizedDirectory === separator) {
    return `${normalizedDirectory}${sanitizeOutputFilename(title)}.${outputFormat}`
  }

  return `${normalizedDirectory}${separator}${sanitizeOutputFilename(title)}.${outputFormat}`
}

export function replaceOutputExtension(filePath: string, outputFormat: OutputFormat): string {
  const separatorIndex = getLastSeparatorIndex(filePath)
  const directory = separatorIndex >= 0 ? filePath.slice(0, separatorIndex + 1) : ''
  const filename = separatorIndex >= 0 ? filePath.slice(separatorIndex + 1) : filePath
  const dotIndex = filename.lastIndexOf('.')
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return `${directory}${basename}.${outputFormat}`
}

export function getEffectiveSavePath(
  filePath: string | undefined,
  outputFormat: OutputFormat,
  createFolderPerDownload: boolean
): string | undefined {
  if (!filePath) {
    return undefined
  }

  const pathWithExtension = replaceOutputExtension(filePath, outputFormat)
  if (!createFolderPerDownload) {
    return pathWithExtension
  }

  const separatorIndex = getLastSeparatorIndex(pathWithExtension)
  const directory =
    separatorIndex === 0
      ? pathWithExtension[0]
      : separatorIndex > 0
        ? pathWithExtension.slice(0, separatorIndex)
        : ''
  const filename =
    separatorIndex >= 0 ? pathWithExtension.slice(separatorIndex + 1) : pathWithExtension
  const dotIndex = filename.lastIndexOf('.')
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  const safeBasename = sanitizeOutputFilename(basename)
  const separator = getSeparator(pathWithExtension)

  if (!directory) {
    return `${safeBasename}${separator}${safeBasename}.${outputFormat}`
  }

  return `${directory}${separator}${safeBasename}${separator}${safeBasename}.${outputFormat}`
}
