import { describe, expect, it } from 'vitest'
import { formatStageHeadline, formatTransferDetail } from './formatters'

describe('renderer formatters', () => {
  it('shows download percentages in the headline', () => {
    expect(
      formatStageHeadline(
        { stage: 'downloading', stageLabel: 'Downloading', percentage: 42.4 },
        'idle'
      )
    ).toBe('Downloading (42%)')
  })

  it('shows processing percentages in the headline', () => {
    expect(
      formatStageHeadline(
        { stage: 'processing', stageLabel: 'Processing', percentage: 42.6 },
        'idle'
      )
    ).toBe('Processing (43%)')
  })

  it('shows transferred bytes with total bytes', () => {
    expect(
      formatTransferDetail({
        stage: 'downloading',
        stageLabel: 'Downloading',
        downloadedBytes: 1024 * 1024,
        totalBytes: 2 * 1024 * 1024
      })
    ).toBe('1.0 MB of 2.0 MB')
  })

  it('avoids waiting text during active stages', () => {
    expect(formatTransferDetail({ stage: 'processing', stageLabel: 'Processing' })).toBe(
      'Processing media'
    )
  })
})
