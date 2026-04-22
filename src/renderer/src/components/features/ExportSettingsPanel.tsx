import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AUDIO_BITRATE_OPTIONS,
  AUDIO_CODECS,
  FRAME_RATE_OPTIONS,
  OUTPUT_FORMATS,
  RESOLUTION_OPTIONS,
  VIDEO_BITRATE_OPTIONS,
  VIDEO_CODECS,
  isAudioOnlyFormat
} from '../../../../shared/formatOptions'
import { normalizeTrimRange } from '../../../../shared/trim'
import type { AudioCodec, OutputFormat, VideoCodec } from '../../../../shared/types'
import { useActiveExportSettings } from '../../hooks/useActiveExportSettings'
import { getBottomScrollState } from '../../lib/bottomScroll'
import { getEffectiveSavePath, replaceOutputExtension } from '../../lib/outputPath'
import { useSettingsStore } from '../../stores/settingsStore'
import { Button } from '../ui/Button'
import { LocationSelector } from '../ui/LocationSelector'
import { RangeSlider } from '../ui/RangeSlider'
import { RadioBoxes } from '../ui/RadioBoxes'
import { SnapSlider } from '../ui/SnapSlider'

export function ExportSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { metadata, exportSettings, readOnly, updateExportSettings } = useActiveExportSettings()
  const settings = useSettingsStore((state) => state.settings)
  const chooseOutputPath = useSettingsStore((state) => state.chooseOutputPath)
  const audioOnly = isAudioOnlyFormat(exportSettings.outputFormat)
  const controlsDisabled = readOnly || metadata == null
  const showSavePath = Boolean(settings?.alwaysAskDownloadLocation)
  const durationSeconds = metadata?.duration ? Math.floor(metadata.duration) : 0
  const trimRange = normalizeTrimRange(
    exportSettings.trimStartSeconds,
    exportSettings.trimEndSeconds,
    durationSeconds
  )
  const displaySavePath = getEffectiveSavePath(
    exportSettings.savePath,
    exportSettings.outputFormat,
    Boolean(settings?.createFolderPerDownload)
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  const updateScrollState = useCallback((): void => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    setShowScrollToBottom(getBottomScrollState(element).showScrollToBottom)
  }, [])

  const resolutionOptions = useMemo(() => {
    const maxResolution = metadata?.maxResolution ?? 2160
    const visible = RESOLUTION_OPTIONS.filter((resolution) => resolution <= maxResolution)
    return ['auto', ...visible] as Array<'auto' | number>
  }, [metadata?.maxResolution])

  const frameRateOptions = useMemo(() => {
    if (!metadata || metadata.fpsOptions.length === 0) {
      return FRAME_RATE_OPTIONS
    }

    const maxFps = Math.max(...metadata.fpsOptions)
    return FRAME_RATE_OPTIONS.filter((option) => option === 'auto' || option <= maxFps)
  }, [metadata])

  useEffect(() => {
    if (!controlsDisabled && !resolutionOptions.includes(exportSettings.resolution)) {
      void updateExportSettings({ resolution: resolutionOptions[resolutionOptions.length - 1] })
    }
  }, [controlsDisabled, exportSettings.resolution, resolutionOptions, updateExportSettings])

  useEffect(() => {
    if (
      !controlsDisabled &&
      durationSeconds > 0 &&
      (trimRange.startSeconds !== exportSettings.trimStartSeconds ||
        trimRange.endSeconds !== exportSettings.trimEndSeconds)
    ) {
      void updateExportSettings({
        trimStartSeconds: trimRange.startSeconds,
        trimEndSeconds: trimRange.endSeconds
      })
    }
  }, [
    controlsDisabled,
    durationSeconds,
    exportSettings.trimEndSeconds,
    exportSettings.trimStartSeconds,
    trimRange.endSeconds,
    trimRange.startSeconds,
    updateExportSettings
  ])

  useEffect(() => {
    if (
      !controlsDisabled &&
      audioOnly &&
      (exportSettings.resolution !== 'auto' ||
        exportSettings.videoBitrate !== 'auto' ||
        exportSettings.videoCodec !== 'auto' ||
        exportSettings.frameRate !== 'auto')
    ) {
      void updateExportSettings({
        resolution: 'auto',
        videoBitrate: 'auto',
        videoCodec: 'auto',
        frameRate: 'auto'
      })
    }
  }, [
    audioOnly,
    controlsDisabled,
    exportSettings.frameRate,
    exportSettings.resolution,
    exportSettings.videoBitrate,
    exportSettings.videoCodec,
    updateExportSettings
  ])

  useEffect(() => {
    if (!showSavePath || controlsDisabled || !exportSettings.savePath) {
      return
    }

    const nextPath = replaceOutputExtension(exportSettings.savePath, exportSettings.outputFormat)
    if (nextPath !== exportSettings.savePath) {
      void updateExportSettings({ savePath: nextPath })
    }
  }, [
    controlsDisabled,
    exportSettings.outputFormat,
    exportSettings.savePath,
    showSavePath,
    updateExportSettings
  ])

  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollState)
    return () => cancelAnimationFrame(frame)
  }, [audioOnly, controlsDisabled, metadata, showSavePath, updateScrollState])

  const chooseSavePath = async (): Promise<void> => {
    if (!metadata || controlsDisabled) {
      return
    }

    const filePath = await chooseOutputPath({
      title: metadata.title,
      outputFormat: exportSettings.outputFormat,
      currentPath: exportSettings.savePath
    })

    if (filePath) {
      await updateExportSettings({ savePath: filePath })
    }
  }

  const openSavePath = (): void => {
    if (exportSettings.savePath) {
      void window.cosmo.shell.openPath({ path: exportSettings.savePath })
    }
  }

  const handleScroll = (): void => {
    updateScrollState()
  }

  const scrollToBottom = (): void => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    element.scrollTop = element.scrollHeight
    setShowScrollToBottom(false)
  }

  return (
    <section className="relative h-full min-h-0 text-white">
      <div ref={scrollRef} className="h-full min-h-0 overflow-y-auto" onScroll={handleScroll}>
        <div className="grid divide-y divide-white/10 border-b border-white/10">
          <div className="p-2">
            <RadioBoxes<OutputFormat>
              value={exportSettings.outputFormat}
              options={OUTPUT_FORMATS.map((format) => ({ value: format, label: format }))}
              disabled={controlsDisabled}
              onChange={(outputFormat) => void updateExportSettings({ outputFormat })}
            />
          </div>

          <div className="p-4">
            <RangeSlider
              label={t('exportSettings.trim')}
              startLabel={t('exportSettings.trimStart')}
              endLabel={t('exportSettings.trimEnd')}
              value={trimRange}
              max={durationSeconds}
              disabled={controlsDisabled}
              invalidLabel={t('exportSettings.trimInvalid')}
              onChange={({ startSeconds, endSeconds }) =>
                void updateExportSettings({
                  trimStartSeconds: startSeconds,
                  trimEndSeconds: endSeconds
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="p-4">
              <SnapSlider
                label={t('exportSettings.resolution')}
                value={exportSettings.resolution}
                options={resolutionOptions}
                disabled={controlsDisabled || audioOnly}
                formatLabel={(value) => (value === 'auto' ? t('exportSettings.auto') : `${value}p`)}
                onChange={(resolution) => void updateExportSettings({ resolution })}
              />
            </div>

            <div className="p-4">
              <SnapSlider
                label={t('exportSettings.frameRate')}
                value={exportSettings.frameRate}
                options={frameRateOptions}
                disabled={controlsDisabled || audioOnly}
                formatLabel={(value) =>
                  value === 'auto' ? t('exportSettings.auto') : `${value} fps`
                }
                onChange={(frameRate) => void updateExportSettings({ frameRate })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="p-4">
              <SnapSlider
                label={t('exportSettings.videoBitrate')}
                value={exportSettings.videoBitrate}
                options={VIDEO_BITRATE_OPTIONS}
                disabled={controlsDisabled || audioOnly}
                formatLabel={(value) =>
                  value === 'auto' ? t('exportSettings.auto') : `${value} Mbps`
                }
                onChange={(videoBitrate) => void updateExportSettings({ videoBitrate })}
              />
            </div>
            <div className="p-4">
              <SnapSlider
                label={t('exportSettings.audioBitrate')}
                value={exportSettings.audioBitrate}
                options={AUDIO_BITRATE_OPTIONS}
                disabled={controlsDisabled}
                formatLabel={(value) =>
                  value === 'auto' ? t('exportSettings.auto') : `${value} kbps`
                }
                onChange={(audioBitrate) => void updateExportSettings({ audioBitrate })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="p-4">
              <RadioBoxes<VideoCodec>
                label={t('exportSettings.videoCodec')}
                value={exportSettings.videoCodec}
                options={VIDEO_CODECS.map((codec) => ({
                  value: codec,
                  label: codec.toUpperCase(),
                  icon: 'video',
                  disabled: controlsDisabled || audioOnly
                }))}
                disabled={controlsDisabled || audioOnly}
                onChange={(videoCodec) => void updateExportSettings({ videoCodec })}
                className="grid-cols-3"
              />
            </div>
            <div className="p-4">
              <RadioBoxes<AudioCodec>
                label={t('exportSettings.audioCodec')}
                value={exportSettings.audioCodec}
                options={AUDIO_CODECS.map((codec) => ({
                  value: codec,
                  label: codec.toUpperCase(),
                  icon: 'music',
                  disabled: controlsDisabled
                }))}
                disabled={controlsDisabled}
                onChange={(audioCodec) => void updateExportSettings({ audioCodec })}
                className="grid-cols-3"
              />
            </div>
          </div>

          {showSavePath ? (
            <div className="p-4 min-w-0">
              <LocationSelector
                mode="file"
                layout="stacked"
                label={t('exportSettings.savePath')}
                value={displaySavePath}
                placeholder={t('exportSettings.noSavePath')}
                chooseLabel={t('actions.choose')}
                disabled={controlsDisabled}
                onChoose={() => void chooseSavePath()}
                onOpen={openSavePath}
              />
            </div>
          ) : null}
        </div>
      </div>

      {showScrollToBottom ? (
        <div className="absolute flex items-end justify-center bottom-0 -left-3 w-full h-32 pl-3 bg-linear-to-b from-transparent to-gray to-95% pointer-events-none">
          <Button
            icon="chevronsDown"
            label={t('actions.scrollToBottom')}
            className="w-full rounded-none border-none pointer-events-auto"
            onClick={scrollToBottom}
            onlyIcon
            ghost
          />
        </div>
      ) : null}
    </section>
  )
}
