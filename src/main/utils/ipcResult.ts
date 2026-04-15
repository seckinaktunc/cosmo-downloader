import type { IpcErrorCode, IpcResult } from '../../shared/types'

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function fail<T = never>(
  code: IpcErrorCode,
  message: string,
  details?: string
): IpcResult<T> {
  return { ok: false, error: { code, message, details } }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
