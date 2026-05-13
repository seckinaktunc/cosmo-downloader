import { extractFirstValidUrlFromText } from '../../../shared/url'
import { classifyVideoUrl } from './videoUrlClassifier'

export function getValidClipboardUrl(text: string): string | null {
  return extractFirstValidUrlFromText(text)
}

export async function readValidClipboardUrl(): Promise<string | null> {
  const result = await window.cosmo.clipboard.readText()
  return result.ok ? getValidClipboardUrl(result.data) : null
}

export function getValidLookingSingleVideoUrl(text: string): string | null {
  const url = extractFirstValidUrlFromText(text)
  if (!url) {
    return null
  }

  return classifyVideoUrl(url) === 'single' ? url : null
}
