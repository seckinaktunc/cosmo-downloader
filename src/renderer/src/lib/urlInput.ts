import { validateUrl } from './validateUrl'
import { classifyVideoUrl } from './videoUrlClassifier'

function firstValidUrlFromText(text: string): string | null {
  const candidates = text
    .split(/\s+/)
    .map((part) => part.trim().replace(/[),.;]+$/g, ''))
    .filter(Boolean)

  for (const candidate of candidates) {
    if (!/^https?:\/\//i.test(candidate) && !/^[^\s/]+\.[^\s/]+/.test(candidate)) {
      continue
    }

    const validation = validateUrl(candidate)
    if (validation.isValid && validation.normalized) {
      return validation.normalized
    }
  }

  return null
}

export function extractDroppedUrl(dataTransfer: DataTransfer): string | null {
  if (dataTransfer.files.length > 0) {
    return null
  }

  const uriList = dataTransfer.getData('text/uri-list')
  if (uriList) {
    const url = firstValidUrlFromText(
      uriList
        .split(/\r?\n/)
        .filter((line) => !line.startsWith('#'))
        .join(' ')
    )
    if (url) {
      return url
    }
  }

  const text = dataTransfer.getData('text/plain')
  return text ? firstValidUrlFromText(text) : null
}

export function extractDroppedSingleVideoUrl(dataTransfer: DataTransfer): string | null {
  const url = extractDroppedUrl(dataTransfer)
  return url && classifyVideoUrl(url) === 'single' ? url : null
}

export function getValidClipboardUrl(text: string): string | null {
  return firstValidUrlFromText(text)
}

export function getValidLookingSingleVideoUrl(text: string): string | null {
  const url = firstValidUrlFromText(text)
  if (!url) {
    return null
  }

  return classifyVideoUrl(url) === 'single' ? url : null
}
