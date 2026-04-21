import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { compactDownloadLogFile } from '@main/services/logCompactionService'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

function tempFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-log-compact-'))
  tempDirs.push(directory)
  return join(directory, 'download.log')
}

describe('compactDownloadLogFile', () => {
  it('compacts repeated saved progress lines in place', () => {
    const logPath = tempFile()
    writeFileSync(
      logPath,
      [
        'start',
        'cosmo-download|  1.0%|1MiB/s|00:10|1|100',
        'cosmo-download|  2.0%|2MiB/s|00:08|2|100',
        'end',
        ''
      ].join('\n')
    )

    compactDownloadLogFile(logPath)

    expect(readFileSync(logPath, 'utf8')).toBe(
      'start\ncosmo-download|  2.0%|2MiB/s|00:08|2|100\nend\n'
    )
  })
})
