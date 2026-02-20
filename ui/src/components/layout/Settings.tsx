import { useEffect, useMemo } from 'react';
import { createBrowserOptions, type BrowserOptionValue } from '@/constants/browserOptions';
import { useDownloadState } from '@/hooks/useDownloadState';
import { postWebViewMessage } from '@/lib/webview';
import { useLocale } from '@/locale';
import { useGlobalStore } from '@/stores/globalStore';
import { useSettingsStore, type LocaleCode } from '@/stores/settingsStore';
import { isActiveDownloadStatus } from '@/types/download';
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
    const installedBrowsers = useSettingsStore((state) => state.installedBrowsers);
    const hasLoadedInstalledBrowsers = useSettingsStore((state) => state.hasLoadedInstalledBrowsers);
    const setBrowserForCookies = useSettingsStore((state) => state.setBrowserForCookies);

    const alwaysAskDownloadDirectory = useSettingsStore((state) => state.alwaysAskDownloadDirectory);
    const toggleAlwaysAskDownloadDirectory = useSettingsStore((state) => state.toggleAlwaysAskDownloadDirectory);

    const defaultDownloadDirectory = useSettingsStore((state) => state.defaultDownloadDirectory);
    const hardwareAccelerationSupported = useSettingsStore((state) => state.hardwareAccelerationSupported);
    const hardwareAccelerationOptions = useSettingsStore((state) => state.hardwareAccelerationOptions);
    const hardwareAccelerationMode = useSettingsStore((state) => state.hardwareAccelerationMode);
    const setHardwareAccelerationMode = useSettingsStore((state) => state.setHardwareAccelerationMode);

    const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
    const toggleAutoCheckUpdates = useSettingsStore((state) => state.toggleAutoCheckUpdates);

    const handleSelectFolder = () => {
        postWebViewMessage("select_default_download_directory");
    };

    const browserOptions = useMemo(() => createBrowserOptions(locale), [locale]);
    const visibleBrowserOptions = useMemo(() => {
        if (!hasLoadedInstalledBrowsers) {
            return browserOptions;
        }

        const installedBrowserSet = new Set(installedBrowsers);
        return browserOptions.filter((option) => (
            option.value === "default" || installedBrowserSet.has(option.value)
        ));
    }, [browserOptions, hasLoadedInstalledBrowsers, installedBrowsers]);

    useEffect(() => {
        if (!hasLoadedInstalledBrowsers) {
            return;
        }

        const hasSelectedBrowser = visibleBrowserOptions.some((option) => option.value === browserForCookies);
        if (!hasSelectedBrowser) {
            setBrowserForCookies("default");
        }
    }, [browserForCookies, hasLoadedInstalledBrowsers, setBrowserForCookies, visibleBrowserOptions]);

    const languageOptions: DropdownOption[] = [
        { value: "tr_TR", label: locale.languages.tr_TR, icon: "flagTR" },
        { value: "en_US", label: locale.languages.en_US, icon: "flagEN" },
        { value: "zh_CN", label: locale.languages.zh_CN, icon: "flagCN" },
    ];

    const hardwareAccelerationDropdownOptions = useMemo<DropdownOption[]>(() => {
        return hardwareAccelerationOptions.map((option) => ({
            value: option,
            label: option === "none"
                ? locale.settings.hardwareAccelerationDisabled
                : option.toUpperCase(),
        }));
    }, [hardwareAccelerationOptions, locale.settings.hardwareAccelerationDisabled]);

    if (!isSettingsOpen) return null;

    return (
        <Box className='flex-col'>
            {isActiveDownloadStatus(state.status) && (
                <div className='absolute inset-0 z-20 bg-dark/85 flex flex-col backdrop-blur-xs justify-center items-center p-4 gap-2 text-center rounded-xl border border-white/5'>
                    <Icon name='spinner' size={32} className='animate-spin' color='var(--color-primary)' />
                    <span className='text-sm text-white/25'>
                        {locale.common.activeDownloadNotice}
                    </span>
                </div>
            )}

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.language}</span>
                <Dropdown
                    options={languageOptions}
                    value={language}
                    onChange={(value) => setLanguage(value as LocaleCode)}
                    placeholder={locale.settings.selectLanguage}
                    buttonClassName='rounded-md'
                    menuClassName='rounded-md'
                />
            </Row>

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.cookiesBrowser}</span>
                <Dropdown
                    options={visibleBrowserOptions}
                    value={browserForCookies}
                    onChange={(value) => setBrowserForCookies(value as BrowserOptionValue)}
                    placeholder={locale.settings.selectBrowser}
                    buttonClassName='rounded-md'
                    menuClassName='rounded-md'
                />
            </Row>

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.alwaysAskDownloadDirectory}</span>
                <ToggleSwitch id='alwaysAskDownloadDirectory' value={alwaysAskDownloadDirectory} onChange={toggleAlwaysAskDownloadDirectory} />
            </Row>

            {!alwaysAskDownloadDirectory && (
                <Row>
                    <div className='flex flex-col overflow-hidden'>
                        <span className='text-sm text-white/50'>{locale.settings.defaultDownloadDirectory}</span>
                        <span className='text-xs text-white/25'>{defaultDownloadDirectory || locale.common.notSelected}</span>
                    </div>
                    <Button
                        variant='secondary'
                        size='sm'
                        label={locale.settings.selectDownloadDirectory}
                        onClick={handleSelectFolder}
                        className='rounded-md'
                    />
                </Row>
            )}

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.hardwareAcceleration}</span>
                <Dropdown
                    options={hardwareAccelerationDropdownOptions}
                    value={hardwareAccelerationMode}
                    onChange={setHardwareAccelerationMode}
                    placeholder={locale.settings.selectHardwareAcceleration}
                    disabled={!hardwareAccelerationSupported && hardwareAccelerationDropdownOptions.length <= 1}
                    buttonClassName='rounded-md'
                    menuClassName='rounded-md'
                />
            </Row>

            <Row>
                <span className='text-sm text-white/50'>{locale.settings.autoCheckUpdates}</span>
                <ToggleSwitch id='autoCheckUpdates' value={autoCheckUpdates} onChange={toggleAutoCheckUpdates} />
            </Row>
        </Box>
    );
}
