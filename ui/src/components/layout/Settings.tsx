import { useDownloadState } from '@/hooks/useDownloadState';
import { useLocale } from '@/locale';
import { useGlobalStore } from '@/stores/globalStore';
import { useSettingsStore, type LocaleCode } from '@/stores/settingsStore';
import Box from '@/components/ui/Box';
import Button from '@/components/Button';
import Dropdown, { type DropdownOption } from '@/components/Dropdown';
import Icon from '@/components/Icon';
import Row from '@/components/ui/Row';
import ToggleSwitch from '@/components/ToggleSwitch';

export default function Settings() {
    const state = useDownloadState();
    const { locale } = useLocale();
    const isSettingsOpen = useGlobalStore((state) => state.isSettingsOpen);

    const language = useSettingsStore((state) => state.language);
    const setLanguage = useSettingsStore((state) => state.setLanguage);

    const browserForCookies = useSettingsStore((state) => state.browserForCookies);
    const setBrowserForCookies = useSettingsStore((state) => state.setBrowserForCookies);

    const alwaysAskDownloadDirectory = useSettingsStore((state) => state.alwaysAskDownloadDirectory);
    const toggleAlwaysAskDownloadDirectory = useSettingsStore((state) => state.toggleAlwaysAskDownloadDirectory);

    const defaultDownloadDirectory = useSettingsStore((state) => state.defaultDownloadDirectory);

    const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
    const toggleAutoCheckUpdates = useSettingsStore((state) => state.toggleAutoCheckUpdates);

    const isHWACCELOn = useSettingsStore((state) => state.isHWACCELOn);
    const toggleHWACCEL = useSettingsStore((state) => state.toggleHWACCEL);

    const handleSelectFolder = async () => {
        console.log(locale.settings.selectFolderDialogLog);
    };

    const browserOptions: DropdownOption[] = [
        { value: "default", label: locale.browsers.default, icon: "settings" },
        { value: "brave", label: locale.browsers.brave, icon: "chrome" },
        { value: "chrome", label: locale.browsers.chrome, icon: "chrome" },
        { value: "chromium", label: locale.browsers.chromium, icon: "chrome" },
        { value: "edge", label: locale.browsers.edge, icon: "edge" },
        { value: "firefox", label: locale.browsers.firefox, icon: "firefox" },
        { value: "opera", label: locale.browsers.opera, icon: "opera" },
        { value: "safari", label: locale.browsers.safari, icon: "safari" },
        { value: "vivaldi", label: locale.browsers.vivaldi, icon: "vivaldi" },
        { value: "whale", label: locale.browsers.whale, icon: "chrome" },
    ];

    const languageOptions: DropdownOption[] = [
        { value: "tr_TR", label: locale.languages.tr_TR, icon: "flagTR" },
        { value: "en_US", label: locale.languages.en_US, icon: "flagEN" },
        { value: "zh_CN", label: locale.languages.zh_CN, icon: "flagCN" },
    ];

    if (!isSettingsOpen) return null;

    return (
        <Box className='flex-col'>
            {state.status !== "idle" && (
                <div className='absolute inset-0 z-20 bg-dark/85 flex flex-col backdrop-blur-xs justify-center items-center p-4 gap-2 text-center rounded-xl border border-white/5'>
                    <Icon name='spinner' size={32} className='animate-spin' />
                    <span className='text-sm text-white/25'>
                        {locale.common.activeDownloadNotice}
                    </span>
                </div>
            )}

            <Row>
                <div className='flex w-full justify-between items-center gap-2'>
                    <span className='text-sm text-white/50'>{locale.settings.language}</span>
                    <Dropdown
                        options={languageOptions}
                        value={language}
                        onChange={(value) => setLanguage(value as LocaleCode)}
                        placeholder={locale.settings.selectLanguage}
                    />
                </div>
            </Row>

            <Row>
                <div className='flex w-full justify-between items-center gap-2'>
                    <span className='text-sm text-white/50'>{locale.settings.cookiesBrowser}</span>
                    <Dropdown
                        options={browserOptions}
                        value={browserForCookies}
                        onChange={setBrowserForCookies}
                        placeholder={locale.settings.selectBrowser}
                    />
                </div>
            </Row>

            <Row>
                <div className='flex w-full justify-between items-center gap-2'>
                    <span className='text-sm text-white/50'>{locale.settings.alwaysAskDownloadDirectory}</span>
                    <ToggleSwitch id='alwaysAskDownloadDirectory' value={alwaysAskDownloadDirectory} onChange={toggleAlwaysAskDownloadDirectory} />
                </div>
            </Row>

            {!alwaysAskDownloadDirectory && (
                <Row>
                    <div className='flex w-full justify-between items-center'>
                        <div className='flex flex-col overflow-hidden'>
                            <span className='text-sm text-white/50'>{locale.settings.defaultDownloadDirectory}</span>
                            <span className='text-xs text-white/25'>{defaultDownloadDirectory || locale.common.notSelected}</span>
                        </div>
                        <Button
                            variant='secondary'
                            size='sm'
                            label={locale.settings.selectDownloadDirectory}
                            onClick={handleSelectFolder}
                        />
                    </div>
                </Row>
            )}

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.hardwareAcceleration}</span>
                <ToggleSwitch id='isHWACCELOn' value={isHWACCELOn} onChange={toggleHWACCEL} />
            </Row>

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.autoCheckUpdates}</span>
                <ToggleSwitch id='autoCheckUpdates' value={autoCheckUpdates} onChange={toggleAutoCheckUpdates} />
            </Row>
        </Box>
    );
}
