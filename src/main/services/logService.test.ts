import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOG_TAIL_BYTES, readDownloadLogTail } from './logService'

const tempDirs: string[] = []

function createTempDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(directory)
  return directory
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('readDownloadLogTail', () => {
  it('reads a small log file fully', () => {
    const logsDirectory = createTempDirectory('cosmo-logs-')
    const logPath = join(logsDirectory, 'small.log')
    writeFileSync(logPath, 'first\nsecond\n', 'utf8')

    const result = readDownloadLogTail(logsDirectory, { logPath })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('first\nsecond\n')
    expect(result.data.truncated).toBe(false)
    expect(result.data.bytesRead).toBe(13)
  })

  it('reads only the bounded tail for large log files', () => {
    const logsDirectory = createTempDirectory('cosmo-logs-')
    const logPath = join(logsDirectory, 'large.log')
    const content = `${'a'.repeat(DEFAULT_LOG_TAIL_BYTES)}tail-marker`
    writeFileSync(logPath, content, 'utf8')

    const result = readDownloadLogTail(logsDirectory, { logPath })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toHaveLength(DEFAULT_LOG_TAIL_BYTES)
    expect(result.data.content.endsWith('tail-marker')).toBe(true)
    expect(result.data.truncated).toBe(true)
  })

  it('rejects paths outside the logs directory', () => {
    const logsDirectory = createTempDirectory('cosmo-logs-')
    const outsideDirectory = createTempDirectory('cosmo-outside-')
    const logPath = join(outsideDirectory, 'outside.log')
    writeFileSync(logPath, 'outside', 'utf8')

    const result = readDownloadLogTail(logsDirectory, { logPath })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns not found for missing log files inside the logs directory', () => {
    const logsDirectory = createTempDirectory('cosmo-logs-')
    mkdirSync(logsDirectory, { recursive: true })

    const result = readDownloadLogTail(logsDirectory, {
      logPath: join(logsDirectory, 'missing.log')
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})
