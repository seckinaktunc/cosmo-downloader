import { closeSync, existsSync, openSync, readSync, statSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'
import type { DownloadLogReadRequest, DownloadLogReadResult, IpcResult } from '../../shared/types'
import { fail, ok } from '../utils/ipcResult'

export const DEFAULT_LOG_TAIL_BYTES = 256 * 1024

function getRequestedByteCount(maxBytes: number | undefined): number {
  if (maxBytes == null || !Number.isFinite(maxBytes)) {
    return DEFAULT_LOG_TAIL_BYTES
  }

  return Math.min(DEFAULT_LOG_TAIL_BYTES, Math.max(1, Math.floor(maxBytes)))
}

function isInsideDirectory(directory: string, target: string): boolean {
  const relativePath = relative(directory, target)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

export function readDownloadLogTail(
  logsDirectory: string,
  request: DownloadLogReadRequest
): IpcResult<DownloadLogReadResult> {
  if (!request.logPath.trim()) {
    return fail('VALIDATION_ERROR', 'Log path is required.')
  }

  const root = resolve(logsDirectory)
  const logPath = resolve(request.logPath)
  if (!isInsideDirectory(root, logPath)) {
    return fail('VALIDATION_ERROR', 'Log path is outside the logs directory.')
  }

  if (!existsSync(logPath)) {
    return fail('NOT_FOUND', 'Log file was not found.')
  }

  const stats = statSync(logPath)
  if (!stats.isFile()) {
    return fail('VALIDATION_ERROR', 'Log path is not a file.')
  }

  const maxBytes = getRequestedByteCount(request.maxBytes)
  const bytesToRead = Math.min(maxBytes, stats.size)
  const buffer = Buffer.alloc(bytesToRead)
  const descriptor = openSync(logPath, 'r')
  let bytesRead = 0

  try {
    bytesRead =
      bytesToRead === 0 ? 0 : readSync(descriptor, buffer, 0, bytesToRead, stats.size - bytesToRead)
  } finally {
    closeSync(descriptor)
  }

  return ok({
    logPath,
    content: buffer.subarray(0, bytesRead).toString('utf8'),
    size: stats.size,
    bytesRead,
    truncated: stats.size > bytesRead,
    updatedAt: stats.mtime.toISOString()
  })
}
