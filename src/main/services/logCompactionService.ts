import { readFileSync, writeFileSync } from 'fs'
import { compactLogContent } from '../../shared/logCompaction'

export function compactDownloadLogFile(logPath: string): void {
  const content = readFileSync(logPath, 'utf8')
  const compacted = compactLogContent(content)
  if (compacted !== content) {
    writeFileSync(logPath, compacted, 'utf8')
  }
}
