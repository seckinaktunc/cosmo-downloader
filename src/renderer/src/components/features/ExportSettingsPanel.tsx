import { useEffect, useMemo } from 'react'
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
import type { AudioCodec, OutputFormat, VideoCodec } from '../../../../shared/types'
import { useActiveExportSettings } from '../../hooks/useActiveExportSettings'
import { RadioBoxes } from '../ui/RadioBoxes'
import { SnapSlider } from '../ui/SnapSlider'

export function ExportSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { metadata, exportSettings, readOnly, label, updateExportSettings } =
    useActiveExportSettings()
  const audioOnly = isAudioOnlyFormat(exportSettings.outputFormat)
  const controlsDisabled = readOnly || metadata == null

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

  return (
    <section className="grid">
      <div className="border-b border-white/10 p-2 text-xs text-white/50">{label}</div>
      <div className="p-2">
        <RadioBoxes<OutputFormat>
          value={exportSettings.outputFormat}
          options={OUTPUT_FORMATS.map((format) => ({ value: format, label: format }))}
          disabled={controlsDisabled}
          onChange={(outputFormat) => void updateExportSettings({ outputFormat })}
        />
      </div>

      <div className="border-y border-white/10 divide-y divide-white/10">
        <div className="grid grid-cols-2 divide-x divide-white/10">
          <div className="p-4">
            <SnapSlider
              label={t('export.resolution')}
              value={exportSettings.resolution}
              options={resolutionOptions}
              disabled={controlsDisabled || audioOnly}
              formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value}p`)}
              onChange={(resolution) => void updateExportSettings({ resolution })}
            />
          </div>

          <div className="p-4">
            <SnapSlider
              label={t('export.frameRate')}
              value={exportSettings.frameRate}
              options={frameRateOptions}
              disabled={controlsDisabled || audioOnly}
              formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value} fps`)}
              onChange={(frameRate) => void updateExportSettings({ frameRate })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/10">
          <div className="p-4">
            <SnapSlider
              label={t('export.videoBitrate')}
              value={exportSettings.videoBitrate}
              options={VIDEO_BITRATE_OPTIONS}
              disabled={controlsDisabled || audioOnly}
              formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value} Mbps`)}
              onChange={(videoBitrate) => void updateExportSettings({ videoBitrate })}
            />
          </div>
          <div className="p-4">
            <SnapSlider
              label={t('export.audioBitrate')}
              value={exportSettings.audioBitrate}
              options={AUDIO_BITRATE_OPTIONS}
              disabled={controlsDisabled}
              formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value} kbps`)}
              onChange={(audioBitrate) => void updateExportSettings({ audioBitrate })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-white/10">
          <div className="p-4">
            <RadioBoxes<VideoCodec>
              label={t('export.videoCodec')}
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
              label={t('export.audioCodec')}
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
      </div>
    </section>
  )
}
