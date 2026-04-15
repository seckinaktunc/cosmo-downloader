import { app, dialog, Notification, WebContents, webContents } from 'electron'
import { ChildProcessWithoutNullStreams } from 'child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { dirname, extname, join, parse } from 'path'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '../../shared/ipc'
import type {
  AudioCodec,
  DownloadProgress,
  DownloadStartRequest,
  IpcResult,
  OutputFormat,
  VideoCodec
} from '../../shared/types'
import { isAudioOnlyFormat } from '../../shared/formatOptions'
import { BinaryMissingError, BinaryService } from './binaryService'
import { createDownloadPlan } from './formatPlanner'
import { createUniquePath } from './filename'
import {
  parseFfmpegProgressChunk,
  parseYtdlpProgressLine,
  YTDLP_PROGRESS_TEMPLATE
} from './progressParser'
import { spawnProcess } from '../utils/process'

type ActiveJob = {
  id: string
  tempDir: string
  logPath: string
  children: Set<ChildProcessWithoutNullStreams>
  cancelled: boolean
  decorateProgress?: (progress: DownloadProgress) => DownloadProgress
  onProgress?: (progress: DownloadProgress) => void
}

type DownloadStartOptions = {
  decorateProgress?: (progress: DownloadProgress) => DownloadProgress
  onProgress?: (progress: DownloadProgress) => void
}

function getAudioEncoder(codec: AudioCodec, outputFormat: OutputFormat): string {
  if (outputFormat === 'wav') return 'pcm_s16le'
  if (codec === 'mp3' || outputFormat === 'mp3') return 'libmp3lame'
  if (codec === 'opus') return 'libopus'
  if (codec === 'vorbis') return 'libvorbis'
  return 'aac'
}

function getVideoEncoder(codec: VideoCodec, outputFormat: OutputFormat): string {
  if (codec === 'av1') return 'libaom-av1'
  if (codec === 'vp9' || outputFormat === 'webm') return 'libvpx-vp9'
  if (codec === 'h265') return 'libx265'
  return 'libx264'
}

function appendVideoEncoderOptions(args: string[], encoder: string): void {
  if (encoder === 'libx264' || encoder === 'libx265') {
    args.push('-preset', 'veryfast')
  }

  if (encoder === 'libvpx-vp9') {
    args.push('-deadline', 'good', '-cpu-used', '4')
  }

  if (encoder === 'libaom-av1') {
    args.push('-cpu-used', '6')
  }
}

function findDownloadedFile(directory: string): string {
  const files = readdirSync(directory)
    .map((name) => join(directory, name))
    .filter((filePath) => {
      if (!existsSync(filePath) || filePath.endsWith('.part')) {
        return false
      }

      return statSync(filePath).isFile()
    })
    .sort((a, b) => statSync(b).size - statSync(a).size)

  if (files.length === 0) {
    throw new Error('yt-dlp finished without producing an output file.')
  }

  return files[0]
}

function removeTempDir(tempDir: string): void {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true })
}

export class DownloadService {
  private activeJob: ActiveJob | null = null

  constructor(private readonly binaryService: BinaryService) {}

  cancel(): IpcResult<null> {
    if (this.activeJob == null) {
      return { ok: true, data: null }
    }

    this.activeJob.cancelled = true
    for (const child of this.activeJob.children) {
      child.kill('SIGTERM')
    }

    return { ok: true, data: null }
  }

  async start(
    webContents: WebContents,
    request: DownloadStartRequest,
    options: DownloadStartOptions = {}
  ): Promise<IpcResult<DownloadProgress>> {
    if (this.activeJob != null) {
      return {
        ok: false,
        error: { code: 'BUSY', message: 'A download is already running.' }
      }
    }

    const jobId = randomUUID()
    const tempDir = join(app.getPath('temp'), 'cosmo-downloader', jobId)
    const logDir = join(app.getPath('userData'), 'logs')
    const logPath = join(logDir, `${jobId}.log`)
    ensureDirectory(tempDir)
    ensureDirectory(logDir)

    const job: ActiveJob = {
      id: jobId,
      tempDir,
      logPath,
      children: new Set(),
      cancelled: false,
      decorateProgress: options.decorateProgress,
      onProgress: options.onProgress
    }
    this.activeJob = job

    const logStream = createWriteStream(logPath, { flags: 'a' })
    const emit = (progress: DownloadProgress): void => {
      const decorated = options.decorateProgress?.(progress) ?? progress
      webContents.send(IPC_CHANNELS.download.progress, decorated)
      webContents.send(IPC_CHANNELS.download.state, decorated)
      options.onProgress?.(decorated)
    }

    try {
      const binaries = this.binaryService.getPaths()
      const plan = createDownloadPlan(request.metadata, request.exportSettings)
      const destination = await this.resolveDestination(request)

      if (destination == null) {
        job.cancelled = true
        emit({ stage: 'cancelled', stageLabel: 'Cancelled', message: 'Download cancelled.' })
        return { ok: false, error: { code: 'CANCELLED', message: 'Download cancelled.' } }
      }

      emit({ stage: 'downloading', stageLabel: 'Downloading', percentage: 0 })
      const sourceFile = await this.runYtDlp(
        job,
        binaries.ytdlp,
        dirname(binaries.ffmpeg),
        request,
        plan
      )

      if (job.cancelled) {
        throw new Error('Download cancelled.')
      }

      if (!plan.needsFfmpegTranscode) {
        ensureDirectory(dirname(destination))
        renameSync(sourceFile, destination)
        const progress = {
          stage: 'completed' as const,
          stageLabel: 'Completed',
          percentage: 100,
          outputPath: destination
        }
        emit(progress)
        this.notifyCompleted(request.metadata.title, destination)
        return { ok: true, data: progress }
      }

      emit({ stage: 'processing', stageLabel: 'Processing', percentage: 0 })
      const processingOutput = join(tempDir, `processed.${plan.targetExtension}`)
      await this.runFfmpeg(job, binaries.ffmpeg, sourceFile, processingOutput, request)

      if (job.cancelled) {
        throw new Error('Download cancelled.')
      }

      ensureDirectory(dirname(destination))
      renameSync(processingOutput, destination)
      const progress = {
        stage: 'completed' as const,
        stageLabel: 'Completed',
        percentage: 100,
        outputPath: destination
      }
      emit(progress)
      this.notifyCompleted(request.metadata.title, destination)
      return { ok: true, data: progress }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (job.cancelled) {
        emit({ stage: 'cancelled', stageLabel: 'Cancelled', message: 'Download cancelled.' })
        return { ok: false, error: { code: 'CANCELLED', message: 'Download cancelled.' } }
      }

      writeFileSync(logPath, `\nFailure:\n${message}\n`, { flag: 'a' })
      emit({ stage: 'failed', stageLabel: 'Failed', message, logPath })

      if (error instanceof BinaryMissingError) {
        return { ok: false, error: { code: 'BINARY_MISSING', message } }
      }

      return { ok: false, error: { code: 'PROCESS_FAILED', message, details: logPath } }
    } finally {
      logStream.end()
      removeTempDir(tempDir)
      this.activeJob = null
    }
  }

  private async resolveDestination(request: DownloadStartRequest): Promise<string | null> {
    const extension = request.exportSettings.outputFormat

    if (request.outputPath) {
      const parsed = parse(request.outputPath)
      const outputExtension = extname(request.outputPath).replace(/^\./, '') || extension
      ensureDirectory(parsed.dir)
      return createUniquePath(parsed.dir, parsed.name, outputExtension)
    }

    if (request.settings.alwaysAskDownloadLocation) {
      const result = await dialog.showSaveDialog({
        title: 'Save download',
        defaultPath: createUniquePath(
          request.settings.defaultDownloadLocation || app.getPath('downloads'),
          request.metadata.title,
          extension
        ),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
      })

      return result.canceled || !result.filePath ? null : result.filePath
    }

    const directory = request.settings.defaultDownloadLocation || app.getPath('downloads')
    ensureDirectory(directory)
    return createUniquePath(directory, request.metadata.title, extension)
  }

  private runYtDlp(
    job: ActiveJob,
    ytdlpPath: string,
    ffmpegDirectory: string,
    request: DownloadStartRequest,
    plan: ReturnType<typeof createDownloadPlan>
  ): Promise<string> {
    const args = [
      '--no-playlist',
      '--newline',
      '--progress',
      '--progress-template',
      YTDLP_PROGRESS_TEMPLATE,
      '--ffmpeg-location',
      ffmpegDirectory,
      '-f',
      plan.formatSelector,
      '-o',
      join(job.tempDir, 'source.%(ext)s')
    ]

    if (plan.ytdlpMergeFormat != null) {
      args.push('--merge-output-format', plan.ytdlpMergeFormat)
    } else if (!isAudioOnlyFormat(request.exportSettings.outputFormat)) {
      args.push('--merge-output-format', 'mkv')
    }

    if (request.settings.cookiesBrowser !== 'none') {
      args.push('--cookies-from-browser', request.settings.cookiesBrowser)
    }

    args.push(request.metadata.url)

    return new Promise((resolve, reject) => {
      const child = spawnProcess(ytdlpPath, args, { cwd: job.tempDir })
      job.children.add(child)
      const stderrLines: string[] = []
      let stdoutBuffer = ''
      let stderrBuffer = ''

      const handleChunk = (chunk: string): void => {
        stdoutBuffer += chunk
        const lines = stdoutBuffer.split(/\r?\n/)
        stdoutBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const parsed = parseYtdlpProgressLine(line)
          if (parsed) {
            this.emitProgress({
              stage: 'downloading',
              stageLabel: 'Downloading',
              ...parsed
            })
          }
        }
      }

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', handleChunk)
      child.stderr.on('data', (chunk: string) => {
        stderrBuffer += chunk
        stderrLines.push(chunk)
        handleChunk(chunk)
      })
      child.on('error', reject)
      child.on('close', (exitCode) => {
        job.children.delete(child)
        if (job.cancelled) {
          reject(new Error('Download cancelled.'))
          return
        }

        if (exitCode !== 0) {
          reject(new Error(stderrLines.join('').trim() || `yt-dlp exited with code ${exitCode}.`))
          return
        }

        if (stderrBuffer.length > 0) {
          writeFileSync(job.logPath, stderrBuffer, { flag: 'a' })
        }

        try {
          resolve(findDownloadedFile(job.tempDir))
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  private runFfmpeg(
    job: ActiveJob,
    ffmpegPath: string,
    inputPath: string,
    outputPath: string,
    request: DownloadStartRequest
  ): Promise<void> {
    const args = ['-hide_banner', '-y']
    if (request.settings.hardwareAcceleration) {
      args.push('-hwaccel', 'auto')
    }

    args.push('-i', inputPath)

    if (isAudioOnlyFormat(request.exportSettings.outputFormat)) {
      args.push(
        '-vn',
        '-c:a',
        getAudioEncoder(request.exportSettings.audioCodec, request.exportSettings.outputFormat)
      )
    } else {
      args.push('-map', '0:v:0?', '-map', '0:a:0?')
      const videoEncoder = getVideoEncoder(
        request.exportSettings.videoCodec,
        request.exportSettings.outputFormat
      )
      args.push('-c:v', videoEncoder)
      appendVideoEncoderOptions(args, videoEncoder)
      args.push(
        '-c:a',
        getAudioEncoder(request.exportSettings.audioCodec, request.exportSettings.outputFormat)
      )
    }

    if (request.exportSettings.audioBitrate !== 'auto') {
      args.push('-b:a', `${request.exportSettings.audioBitrate}k`)
    }

    if (
      request.exportSettings.frameRate !== 'auto' &&
      !isAudioOnlyFormat(request.exportSettings.outputFormat)
    ) {
      args.push('-r', String(request.exportSettings.frameRate))
    }

    args.push('-progress', 'pipe:1', '-nostats', outputPath)

    return new Promise((resolve, reject) => {
      const child = spawnProcess(ffmpegPath, args, { cwd: job.tempDir })
      job.children.add(child)
      const stderrLines: string[] = []
      let progressBuffer = ''

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        const parsed = parseFfmpegProgressChunk(progressBuffer, chunk, request.metadata.duration)
        progressBuffer = parsed.buffer
        if (parsed.progress) {
          this.emitProgress({
            stage: 'processing',
            stageLabel: 'Processing',
            ...parsed.progress
          })
        }
      })
      child.stderr.on('data', (chunk: string) => {
        stderrLines.push(chunk)
      })
      child.on('error', reject)
      child.on('close', (exitCode) => {
        job.children.delete(child)
        if (job.cancelled) {
          reject(new Error('Download cancelled.'))
          return
        }

        if (exitCode !== 0) {
          reject(new Error(stderrLines.join('').trim() || `FFmpeg exited with code ${exitCode}.`))
          return
        }

        if (stderrLines.length > 0) {
          writeFileSync(job.logPath, stderrLines.join(''), { flag: 'a' })
        }
        resolve()
      })
    })
  }

  private emitProgress(progress: DownloadProgress): void {
    const decorated = this.activeJob?.decorateProgress?.(progress) ?? progress
    this.activeJob?.onProgress?.(decorated)

    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.download.progress, decorated)
        contents.send(IPC_CHANNELS.download.state, decorated)
      }
    }
  }

  private notifyCompleted(title: string, outputPath: string): void {
    if (!Notification.isSupported()) {
      return
    }

    new Notification({
      title: 'Download complete',
      body: title,
      silent: false
    })
      .on('click', () => {
        void import('electron').then(({ shell }) => shell.showItemInFolder(outputPath))
      })
      .show()
  }
}
