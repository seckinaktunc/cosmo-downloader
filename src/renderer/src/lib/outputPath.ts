import type { OutputFormat } from '../../../shared/types'

export function replaceOutputExtension(filePath: string, outputFormat: OutputFormat): string {
  const separatorIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const directory = separatorIndex >= 0 ? filePath.slice(0, separatorIndex + 1) : ''
  const filename = separatorIndex >= 0 ? filePath.slice(separatorIndex + 1) : filePath
  const dotIndex = filename.lastIndexOf('.')
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return `${directory}${basename}.${outputFormat}`
}
