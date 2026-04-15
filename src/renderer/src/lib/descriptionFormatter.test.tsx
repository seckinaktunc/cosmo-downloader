import { describe, expect, it } from 'vitest'
import { tokenizeDescriptionLine } from './descriptionFormatter'

describe('description formatter', () => {
  it('tokenizes http and www links', () => {
    expect(tokenizeDescriptionLine('Watch https://example.com/a and www.example.com/b.')).toEqual([
      { type: 'text', value: 'Watch ' },
      { type: 'link', value: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'www.example.com/b', href: 'https://www.example.com/b' },
      { type: 'text', value: '.' }
    ])
  })

  it('tokenizes hashtags without swallowing preceding text', () => {
    expect(tokenizeDescriptionLine('Tags: #music #video')).toEqual([
      { type: 'text', value: 'Tags: ' },
      { type: 'hashtag', value: '#music', href: 'https://www.youtube.com/hashtag/music' },
      { type: 'text', value: ' ' },
      { type: 'hashtag', value: '#video', href: 'https://www.youtube.com/hashtag/video' }
    ])
  })
})
