import { useDownloadState } from '../hooks/useDownloadState';
import { useGlobalStore } from '../stores/globalStore';
import { useSettingsStore } from '../stores/settingsStore';
import Box from './Box';
import Button from './Button';
import Icon from './Icon';
import Row from './Row';
import ToggleSwitch from './ToggleSwitch';

export default function Settings() {
    const state = useDownloadState();
    const isSettingsOpen = useGlobalStore((state) => state.isSettingsOpen);

    const browserForCookies = useSettingsStore((state) => state.browserForCookies);
    const setBrowserForCookies = useSettingsStore((state) => state.setBrowserForCookies);

    const alwaysAskDownloadDirectory = useSettingsStore((state) => state.alwaysAskDownloadDirectory);
    const toggleAlwaysAskDownloadDirectory = useSettingsStore((state) => state.toggleAlwaysAskDownloadDirectory);

    const defaultDownloadDirectory = useSettingsStore((state) => state.defaultDownloadDirectory);
    const setDefaultDownloadDirectory = useSettingsStore((state) => state.setDefaultDownloadDirectory);

    const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
    const toggleAutoCheckUpdates = useSettingsStore((state) => state.toggleAutoCheckUpdates);

    const isHWACCELOn = useSettingsStore((state) => state.isHWACCELOn);
    const toggleHWACCEL = useSettingsStore((state) => state.toggleHWACCEL);

    const handleSelectFolder = async () => {
        console.log("Klasör seçme diyaloğu açılacak...");
    };

    if (!isSettingsOpen) return null;

    return (
        <Box className='relative flex flex-col p-2 overflow-hidden gap-2'>
            {state.status !== "idle" && (
                <div className='absolute inset-0 z-20 bg-dark/85 flex flex-col backdrop-blur-xs justify-center items-center p-4 gap-2 text-center rounded-xl border border-white/5'>
                    <Icon name='spinner' size={32} className='animate-spin' />
                    <span className='text-sm text-white/25'>
                        Şu anda devam eden bir indirme mevcut.
                    </span>
                </div>
            )}

            <Row>
                <div className='flex w-full justify-between items-center gap-2'>
                    <span className='text-sm text-white/50'>Çerezler için kullanılacak tarayıcı</span>
                    <Button
                        variant='secondary'
                        size='sm'
                        label='Tarayıcı seç'
                        onClick={handleSelectFolder}
                    />
                </div>
            </Row>

            <Row>
                <div className='flex w-full justify-between items-center gap-2'>
                    <span className='text-sm text-white/50'>Her zaman indirme yolunu sor</span>
                    <ToggleSwitch id='alwaysAskDownloadDirectory' value={alwaysAskDownloadDirectory} onChange={toggleAlwaysAskDownloadDirectory} />
                </div>
            </Row>

            {!alwaysAskDownloadDirectory && (
                <Row>
                    <div className='flex w-full justify-between items-center'>
                        <div className='flex flex-col overflow-hidden'>
                            <span className='text-sm text-white/50'>Varsayılan indirme konumu</span>
                            <span className='text-xs text-white/25'>{defaultDownloadDirectory || "Henüz seçilmedi"}</span>
                        </div>
                        <Button
                            variant='secondary'
                            size='sm'
                            label='İndirme konumu seç'
                            onClick={handleSelectFolder}
                        />
                    </div>
                </Row>
            )}

            <Row>
                <span className='text-sm text-white/50'>Donanım hızlandırma</span>
                <ToggleSwitch id='isHWACCELOn' value={isHWACCELOn} onChange={toggleHWACCEL} />
            </Row>

            <Row>
                <span className='text-sm text-white/50'>Güncellemeleri otomatik kontrol et</span>
                <ToggleSwitch id='autoCheckUpdates' value={autoCheckUpdates} onChange={toggleAutoCheckUpdates} />
            </Row>
        </Box>
    );
}