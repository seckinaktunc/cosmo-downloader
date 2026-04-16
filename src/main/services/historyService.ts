import { app, clipboard, shell, webContents } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { DownloadHistoryEntry, DownloadHistoryStatus, QueueItem } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc'
import { mergeExportSettings } from '../../shared/defaults'

const HISTORY_FILE = 'history.json'

function now(): string {
  return new Date().toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function readEntries(filePath: string): DownloadHistoryEntry[] {
  if (!existsSync(filePath)) {
    return []
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((entry): entry is DownloadHistoryEntry => {
        return isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.metadata)
      })
      .map((entry) => ({
        ...entry,
        exportSettings: mergeExportSettings(entry.exportSettings)
      }))
  } catch {
    return []
  }
}

export class HistoryService {
  private entries: DownloadHistoryEntry[]

  constructor(private readonly filePath: string = join(app.getPath('userData'), HISTORY_FILE)) {
    this.entries = readEntries(filePath)
  }

  get(): DownloadHistoryEntry[] {
    return [...this.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  addStarted(item: QueueItem): DownloadHistoryEntry {
    const timestamp = now()
    const entry: DownloadHistoryEntry = {
      id: randomUUID(),
      queueItemId: item.id,
      metadata: item.metadata,
      exportSettings: mergeExportSettings(item.exportSettings),
      settings: item.settings,
      status: 'started',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    this.entries = [entry, ...this.entries]
    this.writeAndBroadcast()
    return entry
  }

  update(
    entryId: string,
    status: DownloadHistoryStatus,
    update: Partial<Pick<DownloadHistoryEntry, 'outputPath' | 'logPath' | 'error'>>
  ): DownloadHistoryEntry | undefined {
    const entry = this.entries.find((candidate) => candidate.id === entryId)
    if (!entry) {
      return undefined
    }

    Object.assign(entry, update, { status, updatedAt: now() })
    this.writeAndBroadcast()
    return entry
  }

  remove(entryId: string): DownloadHistoryEntry[] {
    this.entries = this.entries.filter((entry) => entry.id !== entryId)
    this.writeAndBroadcast()
    return this.get()
  }

  removeMany(entryIds: string[]): DownloadHistoryEntry[] {
    const selectedIds = new Set(entryIds)
    this.entries = this.entries.filter((entry) => !selectedIds.has(entry.id))
    this.writeAndBroadcast()
    return this.get()
  }

  clear(): DownloadHistoryEntry[] {
    this.entries = []
    this.writeAndBroadcast()
    return []
  }

  find(entryId: string): DownloadHistoryEntry | undefined {
    return this.entries.find((entry) => entry.id === entryId)
  }

  openOutput(entryId: string): boolean {
    const outputPath = this.find(entryId)?.outputPath
    if (!outputPath || !existsSync(outputPath)) {
      return false
    }

    shell.showItemInFolder(outputPath)
    return true
  }

  copySource(entryId: string): boolean {
    const url = this.find(entryId)?.metadata.webpageUrl ?? this.find(entryId)?.metadata.url
    if (!url) {
      return false
    }

    clipboard.writeText(url)
    return true
  }

  private write(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(this.entries, null, 2)}\n`, 'utf8')
  }

  private writeAndBroadcast(): void {
    this.write()
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.history.changed, this.get())
      }
    }
  }
}
