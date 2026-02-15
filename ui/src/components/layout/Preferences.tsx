import { useMemo } from 'react';
import { AUDIO_BITRATE_OPTIONS, VIDEO_FPS_OPTIONS, VIDEO_RES_OPTIONS } from '../../constants/options';
import { useDownloadState } from '../../hooks/useDownloadState';
import { useLocale } from '../../locale';
import { useDownloadStore } from '../../stores/downloadStore';
import { useGlobalStore } from '../../stores/globalStore';
import Box from '../ui/Box';
import Button from '../Button';
import Formats from '../forms/Format';
import SliderSelector from '../forms/SliderSelector';
import Icon from '../Icon';

export default function Preferences() {
    const state = useDownloadState();
    const isPreferencesOpen = useGlobalStore((state) => state.isPreferencesOpen);
    const format = useDownloadStore((state) => state.format);
    const { locale } = useLocale();

    const resolution = useDownloadStore((state) => state.resolution);
    const setResolution = useDownloadStore((state) => state.setResolution);

    const bitrate = useDownloadStore((state) => state.bitrate);
    const setBitrate = useDownloadStore((state) => state.setBitrate);

    const fps = useDownloadStore((state) => state.fps);
    const setFPS = useDownloadStore((state) => state.setFPS);

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

    if (!isPreferencesOpen) return null;

    return (
        <Box className='relative flex flex-col p-2 min-h-48 overflow-hidden'>
            {state.status !== "idle" && (
                <div className='absolute inset-0 z-20 bg-dark/85 flex flex-col backdrop-blur-xs justify-center items-center p-4 gap-2 text-center rounded-xl border border-white/5'>
                    <Icon name='spinner' size={32} className='animate-spin' />
                    <span className='text-sm text-white/25'>
                        {locale.common.activeDownloadNotice}
                    </span>
                </div>
            )}

            <div className='w-full flex flex-col gap-2'>
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
                <div className='flex w-full gap-2'>
                    <SliderSelector
                        title={locale.preferences.audioQuality}
                        options={bitrateOptions}
                        value={bitrate}
                        onChange={setBitrate}
                    />
                </div>
                <Formats />
                <Button
                    variant='secondary'
                    icon='chevronsDown'
                    iconSize={16}
                    className='w-full h-6 shadow-white/10 border-white/10'
                />
            </div>
        </Box>
    );
}
