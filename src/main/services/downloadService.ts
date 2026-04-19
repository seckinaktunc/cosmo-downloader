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
import { formatTimecode, isTrimActive, normalizeTrimRange } from '../../shared/trim'
import { APP_ICON } from '../appIdentity'
import { BinaryMissingError, BinaryService, type BinaryPaths } from './binaryService'
import { fetchThumbnailImage } from './thumbnailService'
import { createDownloadPlan } from './formatPlanner'
import { createUniquePath, sanitizeFilename } from './filename'
import {
  assertSelectedCodecs,
  hasExplicitCodecSelection,
  probeMediaFile,
  verifySelectedCodecs,
  type MediaProbeResult
} from './mediaProbe'
import {
  parseFfmpegProgressChunk,
  parseYtdlpProgressLine,
  YTDLP_PROGRESS_TEMPLATE
} from './progressParser'
import { killProcessTree, spawnProcess } from '../utils/process'

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

function executableName(baseName: string): string {
  return process.platform === 'win32' ? `${baseName}.exe` : baseName
}

function requireFfprobePath(binaries: BinaryPaths): string {
  if (binaries.ffprobe) {
    return binaries.ffprobe
  }

  throw new BinaryMissingError('ffprobe', join(dirname(binaries.ffmpeg), executableName('ffprobe')))
}

export function createFinalDestinationPath(
  directory: string,
  filename: string,
  extension: string,
  createFolderPerDownload: boolean
): string {
  if (!createFolderPerDownload) {
    return createUniquePath(directory, filename, extension)
  }

  const safeFilename = sanitizeFilename(filename)
  const targetDirectory = join(directory, safeFilename)
  return createUniquePath(targetDirectory, safeFilename, extension)
}

export function shouldTranscodeAfterSourceProbe(
  planNeedsFfmpegTranscode: boolean,
  request: DownloadStartRequest,
  probe: MediaProbeResult
): boolean {
  if (planNeedsFfmpegTranscode) {
    return true
  }

  if (!hasExplicitCodecSelection(request.exportSettings)) {
    return false
  }

  return !verifySelectedCodecs(request.exportSettings, probe).ok
}

export function buildFfmpegTranscodeArgs(
  request: DownloadStartRequest,
  inputPath: string,
  outputPath: string
): string[] {
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
    if (request.exportSettings.videoBitrate !== 'auto') {
      args.push('-b:v', `${request.exportSettings.videoBitrate}M`)
    }
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
  return args
}

function buildDownloadSection(request: DownloadStartRequest): string | undefined {
  if (!isTrimActive(request.exportSettings, request.metadata.duration)) {
    return undefined
  }

  const range = normalizeTrimRange(
    request.exportSettings.trimStartSeconds,
    request.exportSettings.trimEndSeconds,
    request.metadata.duration ?? 0
  )

  return `*${formatTimecode(range.startSeconds)}-${formatTimecode(range.endSeconds)}`
}

export function buildYtDlpArgs({
  tempDir,
  ffmpegDirectory,
  request,
  plan
}: {
  tempDir: string
  ffmpegDirectory: string
  request: DownloadStartRequest
  plan: ReturnType<typeof createDownloadPlan>
}): string[] {
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
    join(tempDir, 'source.%(ext)s')
  ]

  const section = buildDownloadSection(request)
  if (section) {
    args.push('--download-sections', section)
  }

  if (plan.ytdlpMergeFormat != null) {
    args.push('--merge-output-format', plan.ytdlpMergeFormat)
  } else if (!isAudioOnlyFormat(request.exportSettings.outputFormat)) {
    args.push('--merge-output-format', 'mkv')
  }

  if (request.settings.cookiesBrowser !== 'none') {
    args.push('--cookies-from-browser', request.settings.cookiesBrowser)
  }

  args.push(request.metadata.url)

  return args
}

export class DownloadService {
  private activeJob: ActiveJob | null = null

  constructor(private readonly binaryService: BinaryService) {}

  isActive(): boolean {
    return this.activeJob != null
  }

  cancel(): IpcResult<null> {
    if (this.activeJob == null) {
      return { ok: true, data: null }
    }

    this.activeJob.cancelled = true
    for (const child of this.activeJob.children) {
      killProcessTree(child)
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
      const ffprobePath = hasExplicitCodecSelection(request.exportSettings)
        ? requireFfprobePath(binaries)
        : undefined
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

      let needsFfmpegTranscode = plan.needsFfmpegTranscode
      if (!needsFfmpegTranscode && ffprobePath) {
        const sourceProbe = await probeMediaFile(ffprobePath, sourceFile)
        needsFfmpegTranscode = shouldTranscodeAfterSourceProbe(
          plan.needsFfmpegTranscode,
          request,
          sourceProbe
        )
      }

      if (!needsFfmpegTranscode) {
        ensureDirectory(dirname(destination))
        renameSync(sourceFile, destination)
        const progress = {
          stage: 'completed' as const,
          stageLabel: 'Completed',
          percentage: 100,
          outputPath: destination
        }
        emit(progress)
        void this.notifyCompleted(request.metadata.title, destination, request.metadata.thumbnail)
        return { ok: true, data: progress }
      }

      emit({ stage: 'processing', stageLabel: 'Processing', percentage: 0 })
      const processingOutput = join(tempDir, `processed.${plan.targetExtension}`)
      await this.runFfmpeg(job, binaries.ffmpeg, sourceFile, processingOutput, request)

      if (job.cancelled) {
        throw new Error('Download cancelled.')
      }

      if (ffprobePath) {
        const processedProbe = await probeMediaFile(ffprobePath, processingOutput)
        assertSelectedCodecs(request.exportSettings, processedProbe, 'processed output')
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
      void this.notifyCompleted(request.metadata.title, destination, request.metadata.thumbnail)
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

    const requestedPath = request.outputPath ?? request.exportSettings.savePath
    if (requestedPath) {
      const parsed = parse(requestedPath)
      const outputExtension = extname(requestedPath).replace(/^\./, '') || extension
      return createFinalDestinationPath(
        parsed.dir,
        parsed.name,
        outputExtension,
        request.settings.createFolderPerDownload
      )
    }

    if (request.settings.alwaysAskDownloadLocation) {
      const result = await dialog.showSaveDialog({
        title: 'Save download',
        defaultPath: createUniquePath(
          request.settings.lastDownloadDirectory ||
            request.settings.defaultDownloadLocation ||
            app.getPath('downloads'),
          request.metadata.title,
          extension
        ),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      const parsed = parse(result.filePath)
      const outputExtension = extname(result.filePath).replace(/^\./, '') || extension
      return createFinalDestinationPath(
        parsed.dir,
        parsed.name,
        outputExtension,
        request.settings.createFolderPerDownload
      )
    }

    const directory = request.settings.defaultDownloadLocation || app.getPath('downloads')
    return createFinalDestinationPath(
      directory,
      request.metadata.title,
      extension,
      request.settings.createFolderPerDownload
    )
  }

  private runYtDlp(
    job: ActiveJob,
    ytdlpPath: string,
    ffmpegDirectory: string,
    request: DownloadStartRequest,
    plan: ReturnType<typeof createDownloadPlan>
  ): Promise<string> {
    const args = buildYtDlpArgs({
      tempDir: job.tempDir,
      ffmpegDirectory,
      request,
      plan
    })

    return new Promise((resolve, reject) => {
      const child = spawnProcess(ytdlpPath, args, {
        cwd: job.tempDir,
        detached: process.platform !== 'win32'
      })
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
    const args = buildFfmpegTranscodeArgs(request, inputPath, outputPath)

    return new Promise((resolve, reject) => {
      const child = spawnProcess(ffmpegPath, args, {
        cwd: job.tempDir,
        detached: process.platform !== 'win32'
      })
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

  private async notifyCompleted(
    title: string,
    outputPath: string,
    thumbnailUrl: string | undefined
  ): Promise<void> {
    if (!Notification.isSupported()) {
      return
    }

    const thumbnailImage = await fetchThumbnailImage(thumbnailUrl)

    new Notification({
      title: 'Download complete',
      body: title,
      icon: thumbnailImage ?? APP_ICON,
      silent: false
    })
      .on('click', () => {
        void import('electron').then(({ shell }) => shell.showItemInFolder(outputPath))
      })
      .show()
  }
}
