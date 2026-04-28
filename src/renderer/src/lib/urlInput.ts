import { extractFirstValidUrlFromText } from '../../../shared/url'
import { classifyVideoUrl } from './videoUrlClassifier'

export function getValidClipboardUrl(text: string): string | null {
  return extractFirstValidUrlFromText(text)
}

export function getValidLookingSingleVideoUrl(text: string): string | null {
  const url = extractFirstValidUrlFromText(text)
  if (!url) {
    return null
  }

  return classifyVideoUrl(url) === 'single' ? url : null
}
