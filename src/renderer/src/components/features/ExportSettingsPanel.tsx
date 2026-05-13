import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  coerceExportSettingsForFormat,
  getDisabledCodecOptions
} from '../../../../shared/exportCompatibility';
import {
  AUDIO_BITRATE_OPTIONS,
  AUDIO_CODECS,
  FRAME_RATE_OPTIONS,
  OUTPUT_FORMATS,
  RESOLUTION_OPTIONS,
  VIDEO_BITRATE_OPTIONS,
  VIDEO_CODECS,
  isAudioOnlyFormat
} from '../../../../shared/formatOptions';
import { normalizeTrimRange } from '../../../../shared/trim';
import type { AudioCodec, OutputFormat, VideoCodec } from '../../../../shared/types';
import { useActiveExportSettings } from '../../hooks/useActiveExportSettings';
import {
  getEditableSavePathParts,
  replaceOutputBasename,
  replaceOutputExtension,
  sanitizeOutputFilename
} from '../../lib/outputPath';
import { useSettingsStore } from '../../stores/settingsStore';
import { LocationSelector } from '../ui/LocationSelector';
import { RadioBoxes } from '../ui/RadioBoxes';
import { RangeSlider } from '../ui/RangeSlider';
import { SnapSlider } from '../ui/SnapSlider';

type ExportSettingsPanelMetrics = {
  contentHeight: number;
  viewportHeight: number;
};

type ExportSettingsPanelProps = {
  onMetricsChange?: (metrics: ExportSettingsPanelMetrics) => void;
};

export function ExportSettingsPanel({
  onMetricsChange
}: ExportSettingsPanelProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { metadata, exportSettings, readOnly, updateExportSettings } = useActiveExportSettings();
  const settings = useSettingsStore((state) => state.settings);
  const chooseOutputPath = useSettingsStore((state) => state.chooseOutputPath);
  const [savePathBasenameDraft, setSavePathBasenameDraft] = useState<{
    sourcePath: string;
    value: string;
  } | null>(null);
  const audioOnly = isAudioOnlyFormat(exportSettings.outputFormat);
  const controlsDisabled = readOnly || metadata == null;
  const showSavePath = Boolean(settings?.alwaysAskDownloadLocation);
  const durationSeconds = metadata?.duration ? Math.floor(metadata.duration) : 0;
  const trimRange = normalizeTrimRange(
    exportSettings.trimStartSeconds,
    exportSettings.trimEndSeconds,
    durationSeconds
  );
  const savePathParts = getEditableSavePathParts(
    exportSettings.savePath,
    exportSettings.outputFormat,
    Boolean(settings?.createFolderPerDownload)
  );
  const activeSavePathBasenameDraft =
    exportSettings.savePath != null && savePathBasenameDraft?.sourcePath === exportSettings.savePath
      ? savePathBasenameDraft.value
      : null;
  const disabledCodecs = getDisabledCodecOptions({ outputFormat: exportSettings.outputFormat });
  const disabledVideoCodecs = new Set(disabledCodecs.video);
  const disabledAudioCodecs = new Set(disabledCodecs.audio);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const resolutionOptions = useMemo(() => {
    const maxResolution = metadata?.maxResolution ?? 2160;
    const visible = RESOLUTION_OPTIONS.filter((resolution) => resolution <= maxResolution);
    return ['auto', ...visible] as Array<'auto' | number>;
  }, [metadata?.maxResolution]);

  const frameRateOptions = useMemo(() => {
    if (!metadata || metadata.fpsOptions.length === 0) {
      return FRAME_RATE_OPTIONS;
    }

    const maxFps = Math.max(...metadata.fpsOptions);
    return FRAME_RATE_OPTIONS.filter((option) => option === 'auto' || option <= maxFps);
  }, [metadata]);

  useEffect(() => {
    if (!controlsDisabled && !resolutionOptions.includes(exportSettings.resolution)) {
      void updateExportSettings({ resolution: resolutionOptions[resolutionOptions.length - 1] });
    }
  }, [controlsDisabled, exportSettings.resolution, resolutionOptions, updateExportSettings]);

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
      });
    }
  }, [
    controlsDisabled,
    durationSeconds,
    exportSettings.trimEndSeconds,
    exportSettings.trimStartSeconds,
    trimRange.endSeconds,
    trimRange.startSeconds,
    updateExportSettings
  ]);

  useEffect(() => {
    if (
      !controlsDisabled &&
      audioOnly &&
      (exportSettings.resolution !== 'auto' ||
        exportSettings.videoBitrate !== 'auto' ||
        exportSettings.frameRate !== 'auto')
    ) {
      void updateExportSettings({
        resolution: 'auto',
        videoBitrate: 'auto',
        frameRate: 'auto'
      });
    }
  }, [
    audioOnly,
    controlsDisabled,
    exportSettings.frameRate,
    exportSettings.resolution,
    exportSettings.videoBitrate,
    updateExportSettings
  ]);

  useEffect(() => {
    if (!showSavePath || controlsDisabled || !exportSettings.savePath) {
      return;
    }

    const nextPath = replaceOutputExtension(exportSettings.savePath, exportSettings.outputFormat);
    if (nextPath !== exportSettings.savePath) {
      void updateExportSettings({ savePath: nextPath });
    }
  }, [
    controlsDisabled,
    exportSettings.outputFormat,
    exportSettings.savePath,
    showSavePath,
    updateExportSettings
  ]);

  useEffect(() => {
    if (controlsDisabled) {
      return;
    }

    const nextSettings = coerceExportSettingsForFormat(exportSettings);
    if (
      nextSettings.videoCodec !== exportSettings.videoCodec ||
      nextSettings.audioCodec !== exportSettings.audioCodec
    ) {
      void updateExportSettings({
        videoCodec: nextSettings.videoCodec,
        audioCodec: nextSettings.audioCodec
      });
    }
  }, [controlsDisabled, exportSettings, updateExportSettings]);

  useEffect(() => {
    if (!onMetricsChange) {
      return undefined;
    }

    const emitMetrics = (): void => {
      const viewport = scrollRef.current;
      const content = contentRef.current;
      if (!viewport || !content) {
        return;
      }

      onMetricsChange({
        contentHeight: content.scrollHeight,
        viewportHeight: viewport.clientHeight
      });
    };

    emitMetrics();

    const viewportObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => emitMetrics());
    const contentObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => emitMetrics());

    if (scrollRef.current && viewportObserver) {
      viewportObserver.observe(scrollRef.current);
    }

    if (contentRef.current && contentObserver) {
      contentObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', emitMetrics);

    return () => {
      viewportObserver?.disconnect();
      contentObserver?.disconnect();
      window.removeEventListener('resize', emitMetrics);
    };
  }, [
    audioOnly,
    controlsDisabled,
    durationSeconds,
    exportSettings,
    frameRateOptions,
    onMetricsChange,
    resolutionOptions,
    showSavePath
  ]);

  const commitSavePathBasename = (): void => {
    if (controlsDisabled || !exportSettings.savePath || !savePathParts) {
      setSavePathBasenameDraft(null);
      return;
    }

    const nextDraft = activeSavePathBasenameDraft ?? savePathParts.basename;
    const nextBasename = sanitizeOutputFilename(nextDraft, savePathParts.basename);

    if (nextBasename === savePathParts.basename) {
      setSavePathBasenameDraft(null);
      return;
    }

    setSavePathBasenameDraft({
      sourcePath: exportSettings.savePath,
      value: nextBasename
    });
    void updateExportSettings({
      savePath: replaceOutputBasename(exportSettings.savePath, nextBasename)
    });
  };

  const chooseSavePath = async (): Promise<void> => {
    if (!metadata || controlsDisabled) {
      return;
    }

    const filePath = await chooseOutputPath({
      title: metadata.title,
      outputFormat: exportSettings.outputFormat,
      currentPath: exportSettings.savePath
    });

    if (filePath) {
      await updateExportSettings({ savePath: filePath });
    }
  };

  const openSavePath = (): void => {
    if (exportSettings.savePath) {
      void window.cosmo.shell.openPath({ path: exportSettings.savePath });
    }
  };

  const handleOutputFormatChange = (outputFormat: OutputFormat): void => {
    const nextSettings = coerceExportSettingsForFormat(exportSettings, outputFormat);
    if (
      nextSettings.outputFormat === exportSettings.outputFormat &&
      nextSettings.videoCodec === exportSettings.videoCodec &&
      nextSettings.audioCodec === exportSettings.audioCodec
    ) {
      return;
    }

    void updateExportSettings({
      outputFormat: nextSettings.outputFormat,
      videoCodec: nextSettings.videoCodec,
      audioCodec: nextSettings.audioCodec
    });
  };

  const formatOptions = OUTPUT_FORMATS.map((format) => ({
    value: format,
    label: format,
    icon: (format === 'mp3' || format === 'wav' ? 'music' : 'video') as 'music' | 'video',
    tooltip: t(`exportSettings.formatDescriptions.${format}`)
  }));

  const incompatibleWithFormatReason = t(
    'exportSettings.compatibilityReasons.notAvailableWithFormat',
    {
      format: exportSettings.outputFormat.toUpperCase()
    }
  );
  const videoDisabledForAudioOnlyReason = t(
    'exportSettings.compatibilityReasons.videoDisabledForAudioOnly'
  );
  const audioCodecLockedByFormatReason = t(
    'exportSettings.compatibilityReasons.audioCodecLockedByFormat',
    {
      format: exportSettings.outputFormat.toUpperCase()
    }
  );

  const videoCodecOptions = VIDEO_CODECS.map((codec) => {
    const description = t(`exportSettings.videoCodecDescriptions.${codec}`);
    const disabledReason = audioOnly
      ? videoDisabledForAudioOnlyReason
      : disabledVideoCodecs.has(codec)
        ? incompatibleWithFormatReason
        : undefined;

    return {
      value: codec,
      label: codec === 'auto' ? t('exportSettings.auto') : codec.toUpperCase(),
      icon: 'video' as const,
      disabled: audioOnly || disabledVideoCodecs.has(codec),
      tooltip: description,
      disabledReason
    };
  });

  const audioCodecOptions = AUDIO_CODECS.map((codec) => {
    const description = t(`exportSettings.audioCodecDescriptions.${codec}`);
    const disabledReason =
      audioOnly && codec !== 'auto'
        ? audioCodecLockedByFormatReason
        : disabledAudioCodecs.has(codec)
          ? incompatibleWithFormatReason
          : undefined;

    return {
      value: codec,
      label: codec === 'auto' ? t('exportSettings.auto') : codec.toUpperCase(),
      icon: 'music' as const,
      disabled: disabledAudioCodecs.has(codec),
      tooltip: description,
      disabledReason
    };
  });

  return (
    <section className="flex h-full min-h-0 flex-col text-white">
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="h-full min-h-0 overflow-hidden">
          <div ref={contentRef} className="grid divide-y divide-white/10 border-b border-white/10">
            <div className="p-2">
              <RadioBoxes<OutputFormat>
                value={exportSettings.outputFormat}
                options={formatOptions}
                disabled={controlsDisabled}
                onChange={handleOutputFormatChange}
              />
            </div>

            <div className="p-4 py-3.5">
              <RangeSlider
                label={t('exportSettings.trim')}
                startLabel={t('exportSettings.trimStart')}
                endLabel={t('exportSettings.trimEnd')}
                value={trimRange}
                max={durationSeconds}
                scrubPreview={metadata?.scrubPreview}
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
                  formatLabel={(value) =>
                    value === 'auto' ? t('exportSettings.auto') : `${value}p`
                  }
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
              <div className="p-4 pt-3">
                <RadioBoxes<VideoCodec>
                  label={t('exportSettings.videoCodec')}
                  value={exportSettings.videoCodec}
                  options={videoCodecOptions}
                  disabled={controlsDisabled}
                  onChange={(videoCodec) => void updateExportSettings({ videoCodec })}
                  className="grid-cols-3"
                />
              </div>
              <div className="p-4 pt-3">
                <RadioBoxes<AudioCodec>
                  label={t('exportSettings.audioCodec')}
                  value={exportSettings.audioCodec}
                  options={audioCodecOptions}
                  disabled={controlsDisabled}
                  onChange={(audioCodec) => void updateExportSettings({ audioCodec })}
                  className="grid-cols-3"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-16 min-w-0 shrink-0 p-4">
              <LocationSelector
                mode={showSavePath ? 'file' : 'directory'}
                path={savePathParts && savePathParts.leadingPath}
                value={activeSavePathBasenameDraft ?? savePathParts?.basename}
                suffix={savePathParts && savePathParts.trailingSuffix}
                placeholder={t('exportSettings.noSavePath')}
                chooseLabel={t('actions.choose')}
                onChange={(event) => {
                  if (!exportSettings.savePath) return;

                  setSavePathBasenameDraft({
                    sourcePath: exportSettings.savePath,
                    value: event.currentTarget.value
                  });
                }}
                onBlur={commitSavePathBasename}
                onOpen={openSavePath}
                onChoose={() => void chooseSavePath()}
                disabled={controlsDisabled}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
