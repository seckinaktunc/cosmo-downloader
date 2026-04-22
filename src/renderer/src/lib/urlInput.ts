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
