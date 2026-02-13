import { AUDIO_BITRATE_OPTIONS, VIDEO_FPS_OPTIONS, VIDEO_RES_OPTIONS } from '../constants/options';
import { useDownloadState } from '../hooks/useDownloadState';
import { useDownloadStore } from '../stores/downloadStore';
import { useGlobalStore } from '../stores/globalStore';
import Box from './Box';
import Button from './Button';
import Formats from './forms/Format';
import SliderSelector from './forms/SliderSelector';
import Icon from './Icon';

export default function Preferences() {
    const state = useDownloadState();
    const isPreferencesOpen = useGlobalStore((state) => state.isPreferencesOpen);
    const format = useDownloadStore((state) => state.format);

    const resolution = useDownloadStore((state) => state.resolution);
    const setResolution = useDownloadStore((state) => state.setResolution);

    const bitrate = useDownloadStore((state) => state.bitrate);
    const setBitrate = useDownloadStore((state) => state.setBitrate);

    const fps = useDownloadStore((state) => state.fps);
    const setFPS = useDownloadStore((state) => state.setFPS);

    if (!isPreferencesOpen) return null;

    return (
        <Box className='relative flex flex-col p-2 min-h-48 overflow-hidden'>
            {state.status !== "idle" && (
                <div className='absolute inset-0 z-20 bg-dark/85 flex flex-col backdrop-blur-xs justify-center items-center p-4 gap-2 text-center rounded-xl border border-white/5'>
                    <Icon name='spinner' size={32} className='animate-spin' />
                    <span className='text-sm text-white/25'>
                        Şu anda devam eden bir indirme mevcut.
                    </span>
                </div>
            )}

            <div className='w-full flex flex-col gap-2'>
                {(format === "mp4" || format === "mkv" || format === "webm") && (
                    <div className='flex w-full gap-2'>
                        <SliderSelector
                            title="ÇÖZÜNÜRLÜK"
                            options={VIDEO_RES_OPTIONS}
                            value={resolution}
                            onChange={setResolution}
                        />
                        <SliderSelector
                            title="KARE HIZI"
                            options={VIDEO_FPS_OPTIONS}
                            value={fps}
                            onChange={setFPS}
                        />
                    </div>
                )}
                <div className='flex w-full gap-2'>
                    <SliderSelector
                        title="SES KALİTESİ"
                        options={AUDIO_BITRATE_OPTIONS}
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
