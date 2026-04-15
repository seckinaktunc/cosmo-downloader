import { existsSync } from 'fs'
import { dirname, extname, join, parse } from 'path'

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function sanitizeFilename(input: string, fallback = 'video'): string {
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

export function createUniquePath(directory: string, filename: string, extension: string): string {
  const safeBase = sanitizeFilename(filename)
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`
  let candidate = join(directory, `${safeBase}${safeExtension}`)
  let index = 1

  while (existsSync(candidate)) {
    candidate = join(directory, `${safeBase} (${index})${safeExtension}`)
    index += 1
  }

  return candidate
}

export function replaceExtension(filePath: string, extension: string): string {
  const parsed = parse(filePath)
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`
  return join(dirname(filePath), `${parsed.name}${safeExtension}`)
}

export function getPathExtension(filePath: string): string {
  return extname(filePath).replace(/^\./, '').toLowerCase()
}
