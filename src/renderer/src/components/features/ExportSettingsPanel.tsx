import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AUDIO_BITRATE_OPTIONS,
  AUDIO_CODECS,
  FRAME_RATE_OPTIONS,
  OUTPUT_FORMATS,
  RESOLUTION_OPTIONS,
  VIDEO_CODECS,
  isAudioOnlyFormat
} from '../../../../shared/formatOptions'
import type { AudioCodec, OutputFormat, VideoCodec } from '../../../../shared/types'
import { RadioBoxes } from '../ui/RadioBoxes'
import { SnapSlider } from '../ui/SnapSlider'
import { SelectField } from '../ui/SelectField'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'

export function ExportSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const metadata = useVideoStore((state) => state.metadata)
  const exportSettings = useUiStore((state) => state.exportSettings)
  const updateExportSettings = useUiStore((state) => state.updateExportSettings)
  const audioOnly = isAudioOnlyFormat(exportSettings.outputFormat)

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
    if (!resolutionOptions.includes(exportSettings.resolution)) {
      updateExportSettings({ resolution: resolutionOptions[resolutionOptions.length - 1] })
    }
  }, [exportSettings.resolution, resolutionOptions, updateExportSettings])

  useEffect(() => {
    if (audioOnly && exportSettings.resolution !== 'auto') {
      updateExportSettings({ resolution: 'auto', videoCodec: 'auto', frameRate: 'auto' })
    }
  }, [audioOnly, exportSettings.resolution, updateExportSettings])

  return (
    <section className="grid gap-2">
      <RadioBoxes<OutputFormat>
        value={exportSettings.outputFormat}
        options={OUTPUT_FORMATS.map((format) => ({ value: format, label: format }))}
        onChange={(outputFormat) => updateExportSettings({ outputFormat })}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-white/5 p-3 border border-white/10">
          <SnapSlider
            label={t('export.resolution')}
            value={exportSettings.resolution}
            options={resolutionOptions}
            disabled={audioOnly}
            formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value}p`)}
            onChange={(resolution) => updateExportSettings({ resolution })}
          />
        </div>

        <div className="rounded-sm bg-white/5 p-3 border border-white/10">
          <SnapSlider
            label={t('export.frameRate')}
            value={exportSettings.frameRate}
            options={frameRateOptions}
            disabled={audioOnly}
            formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value} fps`)}
            onChange={(frameRate) => updateExportSettings({ frameRate })}
          />
        </div>
      </div>

      <div className="rounded-sm bg-white/5 p-3 border border-white/10">
        <SnapSlider
          label={t('export.audioBitrate')}
          value={exportSettings.audioBitrate}
          options={AUDIO_BITRATE_OPTIONS}
          formatLabel={(value) => (value === 'auto' ? t('export.auto') : `${value} kbps`)}
          onChange={(audioBitrate) => updateExportSettings({ audioBitrate })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-white/5 p-3 border border-white/10">
          <SelectField<VideoCodec>
            label={t('export.videoCodec')}
            value={exportSettings.videoCodec}
            options={VIDEO_CODECS.map((codec) => ({
              value: codec,
              label: codec.toUpperCase(),
              icon: 'video'
            }))}
            onChange={(videoCodec) => updateExportSettings({ videoCodec })}
          />
        </div>
        <div className="rounded-sm bg-white/5 p-3 border border-white/10">
          <SelectField<AudioCodec>
            label={t('export.audioCodec')}
            value={exportSettings.audioCodec}
            options={AUDIO_CODECS.map((codec) => ({
              value: codec,
              label: codec.toUpperCase(),
              icon: 'music'
            }))}
            onChange={(audioCodec) => updateExportSettings({ audioCodec })}
          />
        </div>
      </div>
    </section>
  )
}
