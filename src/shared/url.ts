export type ValidateUrlOptions = {
  allowedProtocols?: Array<'http:' | 'https:'>
  allowLocalhost?: boolean
  allowHash?: boolean
  maxLength?: number
}

export type ValidateUrlResult = {
  isValid: boolean
  normalized?: string
  reason?: string
}

export type VideoUrlKind = 'single' | 'playlist' | 'channel' | 'unsupported'

const DEFAULTS: Required<ValidateUrlOptions> = {
  allowedProtocols: ['http:', 'https:'],
  allowLocalhost: false,
  allowHash: true,
  maxLength: 4096
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export function normalizeInputUrl(input: string): string {
  const trimmed = input.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return trimmed
}

export function validateUrl(input: string, options?: ValidateUrlOptions): ValidateUrlResult {
  const opts = { ...DEFAULTS, ...options }
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { isValid: false, reason: 'Enter a URL first.' }
  }

  const trimmed = input.trim()
  if (trimmed.length > opts.maxLength) {
    return { isValid: false, reason: 'The URL is too long.' }
  }

  let url: URL
  try {
    url = new URL(normalizeInputUrl(trimmed))
  } catch {
    return { isValid: false, reason: 'This does not look like a valid URL.' }
  }

  if (!opts.allowedProtocols.includes(url.protocol as 'http:' | 'https:')) {
    return { isValid: false, reason: 'Only HTTP and HTTPS links are supported.' }
  }

  const hostname = url.hostname.toLowerCase()
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  if (!opts.allowLocalhost && isLocalhost) {
    return { isValid: false, reason: 'Local URLs are not supported.' }
  }

  if (!opts.allowHash && url.hash) {
    return { isValid: false, reason: 'URL fragments are not supported.' }
  }

  return { isValid: true, normalized: url.toString() }
}

function normalizeHostname(hostname: string): string {
  const lowered = hostname.toLowerCase()
  return lowered.startsWith('www.') ? lowered.slice(4) : lowered
}

function splitPath(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function hasYouTubeVideoId(url: URL): boolean {
  const hostname = normalizeHostname(url.hostname)
  const pathParts = splitPath(url.pathname)

  if (hostname === 'youtu.be') {
    return YOUTUBE_VIDEO_ID_PATTERN.test(pathParts[0] ?? '')
  }

  if (!hostname.endsWith('youtube.com')) {
    return false
  }

  if (url.pathname === '/watch') {
    return YOUTUBE_VIDEO_ID_PATTERN.test(url.searchParams.get('v') ?? '')
  }

  const [first = '', second = ''] = pathParts
  return (
    (first === 'shorts' || first === 'embed' || first === 'live') &&
    YOUTUBE_VIDEO_ID_PATTERN.test(second)
  )
}

export function classifyVideoUrl(input: string): VideoUrlKind {
  const validation = validateUrl(input)
  if (!validation.isValid || !validation.normalized) {
    return 'unsupported'
  }

  const url = new URL(validation.normalized)
  const hostname = normalizeHostname(url.hostname)
  const pathParts = splitPath(url.pathname)

  if (hostname.endsWith('youtube.com')) {
    if (hasYouTubeVideoId(url)) {
      return 'single'
    }

    if (
      url.pathname === '/playlist' ||
      pathParts[0] === 'channel' ||
      pathParts[0] === 'c' ||
      pathParts[0] === 'user' ||
      (pathParts[0] ?? '').startsWith('@')
    ) {
      return url.pathname === '/playlist' ? 'playlist' : 'channel'
    }
  }

  if (hostname.endsWith('instagram.com')) {
    const first = pathParts[0] ?? ''
    if (first === 'reel' || first === 'p' || first === 'tv') {
      return 'single'
    }
    return pathParts.length > 0 ? 'channel' : 'unsupported'
  }

  if (hostname.endsWith('tiktok.com')) {
    if (hostname === 'vm.tiktok.com' || hostname === 'vt.tiktok.com') {
      return pathParts.length > 0 ? 'single' : 'unsupported'
    }
    if ((pathParts[0] ?? '').startsWith('@') && pathParts[1] === 'video') {
      return 'single'
    }
    return pathParts.length > 0 ? 'channel' : 'unsupported'
  }

  return 'single'
}

export function isSingleVideoUrl(input: string): boolean {
  return classifyVideoUrl(input) === 'single'
}
