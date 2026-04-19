import { app, clipboard, dialog, nativeImage, net, shell, type NativeImage } from 'electron'
import { writeFileSync } from 'fs'
import { extname } from 'path'
import type { IpcResult, ThumbnailRequest } from '../../shared/types'
import { createUniquePath } from './filename'
import { fail, ok } from '../utils/ipcResult'

function validateRemoteImageUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function extensionFromContentType(contentType: string | null): string | undefined {
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/gif') return 'gif'
  return undefined
}

function extensionFromUrl(url: URL): string | undefined {
  const extension = extname(url.pathname).replace(/^\./, '').toLowerCase()
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : undefined
}

async function fetchThumbnail(request: ThumbnailRequest): Promise<
  | {
      buffer: Buffer
      extension: string
    }
  | IpcResult<never>
> {
  const url = validateRemoteImageUrl(request.url)
  if (!url) {
    return fail('VALIDATION_ERROR', 'Thumbnail URL must be HTTP or HTTPS.')
  }

  const response = await net.fetch(url.toString())
  if (!response.ok) {
    return fail('PROCESS_FAILED', `Thumbnail request failed with status ${response.status}.`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const extension =
    extensionFromContentType(response.headers.get('content-type')) ?? extensionFromUrl(url) ?? 'png'

  return {
    buffer: Buffer.from(arrayBuffer),
    extension
  }
}

export async function downloadThumbnail(
  request: ThumbnailRequest
): Promise<IpcResult<string | null>> {
  try {
    const fetched = await fetchThumbnail(request)
    if ('ok' in fetched) {
      return fetched
    }

    const defaultPath = createUniquePath(
      app.getPath('downloads'),
      request.title ? `${request.title} thumbnail` : 'thumbnail',
      fetched.extension
    )
    const result = await dialog.showSaveDialog({
      title: 'Save thumbnail',
      defaultPath,
      filters: [{ name: fetched.extension.toUpperCase(), extensions: [fetched.extension] }]
    })

    if (result.canceled || !result.filePath) {
      return ok(null)
    }

    writeFileSync(result.filePath, fetched.buffer)
    return ok(result.filePath)
  } catch (error) {
    return fail('PROCESS_FAILED', error instanceof Error ? error.message : String(error))
  }
}

export async function copyThumbnailImage(request: ThumbnailRequest): Promise<IpcResult<null>> {
  try {
    const fetched = await fetchThumbnail(request)
    if ('ok' in fetched) {
      return fetched
    }

    const image = nativeImage.createFromBuffer(fetched.buffer)
    if (image.isEmpty()) {
      return fail('PROCESS_FAILED', 'Thumbnail image could not be decoded.')
    }

    clipboard.writeImage(image)
    return ok(null)
  } catch (error) {
    return fail('PROCESS_FAILED', error instanceof Error ? error.message : String(error))
  }
}

export async function fetchThumbnailImage(url: string | undefined): Promise<NativeImage | null> {
  if (!url) {
    return null
  }

  try {
    const fetched = await fetchThumbnail({ url })
    if ('ok' in fetched) {
      return null
    }

    const image = nativeImage.createFromBuffer(fetched.buffer)
    return image.isEmpty() ? null : image
  } catch {
    return null
  }
}

export async function openThumbnailExternal(request: ThumbnailRequest): Promise<IpcResult<null>> {
  const url = validateRemoteImageUrl(request.url)
  if (!url) {
    return fail('VALIDATION_ERROR', 'Thumbnail URL must be HTTP or HTTPS.')
  }

  await shell.openExternal(url.toString())
  return ok(null)
}
