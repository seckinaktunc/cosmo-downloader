import { describe, expect, it } from 'vitest'
import { appendCompactedLogLines, compactLogContent } from '@shared/logCompaction'

describe('log compaction', () => {
  it('keeps only the latest yt-dlp progress line in a progress run', () => {
    expect(
      compactLogContent(
        [
          '[time] Process: yt-dlp',
          'cosmo-download|  4.8%|1MiB/s|02:10|100|200',
          'cosmo-download|  4.9%|2MiB/s|02:08|110|200',
          'normal line',
          ''
        ].join('\n')
      )
    ).toBe('[time] Process: yt-dlp\ncosmo-download|  4.9%|2MiB/s|02:08|110|200\nnormal line\n')
  })

  it('collapses ffmpeg progress fields into one latest progress display line', () => {
    expect(
      compactLogContent(
        [
          '[time] Process: ffmpeg',
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
          'progress=continue',
          'done',
          ''
        ].join('\n')
      )
    ).toBe(
      '[time] Process: ffmpeg\nffmpeg-progress|frame=84|fps=25.0|bitrate=2048.0kbits/s|out_time=00:00:04.000000|speed=1.6x|progress=continue\ndone\n'
    )
  })

  it('appends live lines using the same compaction rules as saved logs', () => {
    expect(
      appendCompactedLogLines('existing\ncosmo-download|  1.0%|1MiB/s|00:10|1|100\n', [
        'cosmo-download|  2.0%|2MiB/s|00:08|2|100'
      ])
    ).toBe('existing\ncosmo-download|  2.0%|2MiB/s|00:08|2|100\n')
  })
})
