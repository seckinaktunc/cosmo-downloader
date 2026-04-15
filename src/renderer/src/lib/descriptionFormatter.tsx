import type { ReactNode } from 'react'

type DescriptionToken =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'hashtag'; value: string; href: string }

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+/giu
const HASHTAG_PATTERN = /(^|[^\p{L}\p{N}_])#[\p{L}\p{N}_]+/giu
const TRAILING_URL_PUNCTUATION = /[.,!?;:]+$/u

function normalizeUrl(value: string): string {
  return value.startsWith('www.') ? `https://${value}` : value
}

function splitTrailingPunctuation(value: string): { body: string; trailing: string } {
  const match = value.match(TRAILING_URL_PUNCTUATION)
  if (!match) {
    return { body: value, trailing: '' }
  }

  return {
    body: value.slice(0, -match[0].length),
    trailing: match[0]
  }
}

function tokenizeHashtags(text: string): DescriptionToken[] {
  const tokens: DescriptionToken[] = []
  let cursor = 0

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const fullMatch = match[0]
    const prefix = match[1] ?? ''
    const hashtag = fullMatch.slice(prefix.length)
    const start = (match.index ?? 0) + prefix.length

    if (start > cursor) {
      tokens.push({ type: 'text', value: text.slice(cursor, start) })
    }

    const tag = hashtag.slice(1)
    tokens.push({
      type: 'hashtag',
      value: hashtag,
      href: `https://www.youtube.com/hashtag/${encodeURIComponent(tag)}`
    })
    cursor = start + hashtag.length
  }

  if (cursor < text.length) {
    tokens.push({ type: 'text', value: text.slice(cursor) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }]
}

export function tokenizeDescriptionLine(line: string): DescriptionToken[] {
  const tokens: DescriptionToken[] = []
  let cursor = 0

  for (const match of line.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const start = match.index ?? 0

    if (start > cursor) {
      tokens.push(...tokenizeHashtags(line.slice(cursor, start)))
    }

    const { body, trailing } = splitTrailingPunctuation(rawUrl)
    tokens.push({ type: 'link', value: body, href: normalizeUrl(body) })
    if (trailing) {
      tokens.push({ type: 'text', value: trailing })
    }

    cursor = start + rawUrl.length
  }

  if (cursor < line.length) {
    tokens.push(...tokenizeHashtags(line.slice(cursor)))
  }

  return tokens
}

export function renderFormattedDescription(description: string): ReactNode {
  return description.split(/\r?\n/).map((line, lineIndex) => (
    <p key={`${lineIndex}-${line}`} className="min-h-lh text-white/50">
      {tokenizeDescriptionLine(line).map((token, tokenIndex) => {
        const key = `${lineIndex}-${tokenIndex}-${token.value}`

        if (token.type === 'link' || token.type === 'hashtag') {
          return (
            <a
              key={key}
              href={token.href}
              target="_blank"
              rel="noreferrer"
              className="text-white underline-offset-2 hover:underline"
            >
              {token.value}
            </a>
          )
        }

        return <span key={key}>{token.value}</span>
      })}
    </p>
  ))
}
