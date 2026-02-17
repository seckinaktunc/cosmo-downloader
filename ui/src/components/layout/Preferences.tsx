import { cn } from '@/utils/cn';
import { useMemo } from 'react';
import {
    AUDIO_BITRATE_OPTIONS,
    AUDIO_CODEC_OPTIONS,
    FORMAT_OPTIONS,
    VIDEO_CODEC_OPTIONS,
    VIDEO_FPS_OPTIONS,
    VIDEO_RES_OPTIONS,
} from '../../constants/options';
import { useDownloadState } from '../../hooks/useDownloadState';
import { useLocale } from '../../locale';
import {
    useDownloadStore,
    type AudioCodecOption,
    type FormatOption,
    type VideoCodecOption,
} from '../../stores/downloadStore';
import { useGlobalStore } from '../../stores/globalStore';
import Button from '../Button';
import RadioSelector from '../forms/RadioSelector';
import SliderSelector from '../forms/SliderSelector';
import Icon from '../Icon';
import Box from '../ui/Box';

export default function Preferences() {
    const state = useDownloadState();
    const isPreferencesOpen = useGlobalStore((state) => state.isPreferencesOpen);
    const { locale } = useLocale();

    const isAdvancedPreferencesOpen = useGlobalStore((state) => state.isAdvancedPreferencesOpen);
    const toggleAdvancedPreferences = useGlobalStore((state) => state.toggleAdvancedPreferences);

    const resolution = useDownloadStore((state) => state.resolution);
    const setResolution = useDownloadStore((state) => state.setResolution);

    const bitrate = useDownloadStore((state) => state.bitrate);
    const setBitrate = useDownloadStore((state) => state.setBitrate);

    const fps = useDownloadStore((state) => state.fps);
    const setFPS = useDownloadStore((state) => state.setFPS);

    const format = useDownloadStore((state) => state.format);
    const setFormat = useDownloadStore((state) => state.setFormat);
    const videoCodec = useDownloadStore((state) => state.videoCodec);
    const setVideoCodec = useDownloadStore((state) => state.setVideoCodec);
    const audioCodec = useDownloadStore((state) => state.audioCodec);
    const setAudioCodec = useDownloadStore((state) => state.setAudioCodec);

    const resolutionOptions = useMemo(
        () =>
            VIDEO_RES_OPTIONS.map((value) => ({
                value,
                label: value === 1440 ? "2K" : value === 2160 ? "4K" : `${value}p`,
            })),
        [],
    );

    const fpsOptions = useMemo(
        () =>
            VIDEO_FPS_OPTIONS.map((value) => ({
                value,
                label: value === 30
                    ? `${value} ${locale.common.fps} (${locale.preferences.fpsStandard})`
                    : `${value} ${locale.common.fps}`,
            })),
        [locale.common.fps, locale.preferences.fpsStandard],
    );

    const bitrateOptions = useMemo(
        () =>
            AUDIO_BITRATE_OPTIONS.map((value) => ({
                value,
                label: `${value} ${locale.common.kbps}`,
            })),
        [locale.common.kbps],
    );

    const formatOptions = useMemo(
        () =>
            FORMAT_OPTIONS.map((option) => ({
                value: option,
                label: option.toUpperCase(),
                helper: locale.formats.helpers[option],
            })),
        [locale.formats.helpers],
    );

    const videoCodecOptions = useMemo(
        () =>
            VIDEO_CODEC_OPTIONS.map((option) => ({
                value: option,
                label: option === "auto" ? locale.codecs.auto : locale.codecs.video.labels[option],
                helper: locale.codecs.video.helpers[option],
            })),
        [locale.codecs.auto, locale.codecs.video.helpers, locale.codecs.video.labels],
    );

    const audioCodecOptions = useMemo(
        () =>
            AUDIO_CODEC_OPTIONS.map((option) => ({
                value: option,
                label: option === "auto" ? locale.codecs.auto : locale.codecs.audio.labels[option],
                helper: locale.codecs.audio.helpers[option],
            })),
        [locale.codecs.audio.helpers, locale.codecs.audio.labels, locale.codecs.auto],
    );

    const selectedVideoCodecLabel = videoCodecOptions.find((option) => option.value === videoCodec)?.label
        ?? locale.common.notSelected;
    const selectedAudioCodecLabel = audioCodecOptions.find((option) => option.value === audioCodec)?.label
        ?? locale.common.notSelected;

    if (!isPreferencesOpen) return null;

    return (
        <Box className='flex-col'>
            {state.status === "downloading" && (
                <div className='absolute inset-0 z-20 bg-dark/85 flex flex-col backdrop-blur-xs justify-center items-center p-4 gap-2 text-center rounded-xl border border-white/5'>
                    <Icon name='spinner' size={32} className='animate-spin' color='var(--color-primary)' />
                    <span className='text-sm text-white/25'>
                        {locale.common.activeDownloadNotice}
                    </span>
                </div>
            )}

            {(format === "mp4" || format === "mkv" || format === "webm") && (
                <div className='flex w-full gap-2'>
                    <SliderSelector
                        title={locale.preferences.resolution}
                        options={resolutionOptions}
                        value={resolution}
                        onChange={setResolution}
                    />
                    <SliderSelector
                        title={locale.preferences.frameRate}
                        options={fpsOptions}
                        value={fps}
                        onChange={setFPS}
                    />
                </div>
            )}

            <SliderSelector
                title={locale.preferences.audioQuality}
                options={bitrateOptions}
                value={bitrate}
                onChange={setBitrate}
            />
            <RadioSelector<FormatOption>
                title={locale.common.format}
                name="format"
                options={formatOptions}
                value={format}
                actionButtonLabel={locale.formats.actionButtonLabel}
                actionButtonIcon='download'
                onChange={setFormat}
            />
            {isAdvancedPreferencesOpen && (
                <div className='flex w-full flex-col gap-2'>
                    {(format === "mp4" || format === "mkv" || format === "webm") && (

                        <RadioSelector<VideoCodecOption>
                            title={locale.preferences.videoCodec}
                            hint={selectedVideoCodecLabel}
                            name="video-codec"
                            options={videoCodecOptions}
                            value={videoCodec}
                            onChange={setVideoCodec}
                        />
                    )}
                    <RadioSelector<AudioCodecOption>
                        title={locale.preferences.audioCodec}
                        hint={selectedAudioCodecLabel}
                        name="audio-codec"
                        options={audioCodecOptions}
                        value={audioCodec}
                        onChange={setAudioCodec}
                    />
                </div>
            )}
            <Button
                variant='secondary'
                icon='chevronsDown'
                iconSize={16}
                className='w-full h-6 shadow-white/15 border-white/15 bg-dark'
                onClick={toggleAdvancedPreferences}
                iconClassName={cn(
                    "shrink-0 transition-transform duration-150",
                    isAdvancedPreferencesOpen && "rotate-180",
                )}
            />
        </Box>
    );
}
