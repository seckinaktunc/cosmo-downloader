import { describe, expect, it } from 'vitest'
import type { DownloadLogReadResult } from '@shared/types'
import { appendLiveLogLines } from '@renderer/lib/logContent'

function logResult(logPath: string, content = ''): DownloadLogReadResult {
  return {
    logPath,
    content,
    size: content.length,
    bytesRead: content.length,
    truncated: false
  }
}

describe('appendLiveLogLines', () => {
  it('appends live line batches for the active log path', () => {
    const result = appendLiveLogLines(
      logResult('/logs/active.log', 'existing\n'),
      {
        logPath: '/logs/active.log',
        lines: ['line one', 'line two'],
        timestamp: '2026-04-21T10:00:00.000Z'
      },
      '/logs/active.log'
    )

    expect(result?.content).toBe('existing\nline one\nline two\n')
  })

  it('replaces the trailing yt-dlp progress line instead of appending repeated updates', () => {
    const result = appendLiveLogLines(
      logResult('/logs/active.log', 'existing\ncosmo-download|  4.8%|1MiB/s|02:10|100|200\n'),
      {
        logPath: '/logs/active.log',
        lines: ['cosmo-download|  4.9%|2MiB/s|02:08|110|200'],
        timestamp: '2026-04-21T10:00:00.000Z'
      },
      '/logs/active.log'
    )

    expect(result?.content).toBe('existing\ncosmo-download|  4.9%|2MiB/s|02:08|110|200\n')
  })

  it('collapses a trailing run of yt-dlp progress lines loaded from disk', () => {
    const result = appendLiveLogLines(
      logResult(
        '/logs/active.log',
        [
          'existing',
          'cosmo-download|  4.8%|1MiB/s|02:10|100|200',
          'cosmo-download|  4.8%|1.5MiB/s|02:09|105|200',
          ''
        ].join('\n')
      ),
      {
        logPath: '/logs/active.log',
        lines: ['cosmo-download|  4.9%|2MiB/s|02:08|110|200'],
        timestamp: '2026-04-21T10:00:00.000Z'
      },
      '/logs/active.log'
    )

    expect(result?.content).toBe('existing\ncosmo-download|  4.9%|2MiB/s|02:08|110|200\n')
  })

  it('coalesces ffmpeg progress fields into one replacing live line', () => {
    const result = appendLiveLogLines(
      logResult('/logs/active.log', 'existing\n'),
      {
        logPath: '/logs/active.log',
        lines: [
          'frame=42',
          'fps=24.0',
          'bitrate=2048.0kbits/s',
          'out_time=00:00:02.000000',
          'speed=1.5x',
          'progress=continue',
          'frame=84',
          'fps=25.0',
          'out_time=00:00:04.000000',
          'speed=1.6x',
          'progress=continue'
        ],
        timestamp: '2026-04-21T10:00:00.000Z'
      },
      '/logs/active.log'
    )

    expect(result?.content).toBe(
      'existing\nffmpeg-progress|frame=84|fps=25.0|bitrate=2048.0kbits/s|out_time=00:00:04.000000|speed=1.6x|progress=continue\n'
    )
  })

  it('ignores live line batches for inactive log paths', () => {
    const current = logResult('/logs/active.log', 'existing\n')
    const result = appendLiveLogLines(
      current,
      {
        logPath: '/logs/inactive.log',
        lines: ['hidden'],
        timestamp: '2026-04-21T10:00:00.000Z'
      },
      '/logs/active.log'
    )

    expect(result).toBe(current)
  })
})
