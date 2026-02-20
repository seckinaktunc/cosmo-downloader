import { IconAdjustmentsHorizontal, IconBackspace, IconChevronDown, IconChevronsDown, IconDownload, IconFileImport, IconFileInfo, IconLoader2, IconPin, IconPinFilled, IconSearch, IconSettings, IconSettingsFilled, IconX } from '@tabler/icons-react';
import React from 'react';
import BraveIcon from './icons/BraveIcon';
import ChinaFlagIcon from './icons/ChinaFlagIcon';
import ChromeIcon from './icons/ChromeIcon';
import ChromiumIcon from './icons/ChromiumIcon';
import EdgeIcon from './icons/EdgeIcon';
import FirefoxIcon from './icons/FirefoxIcon';
import OperaIcon from './icons/OperaIcon';
import SafariIcon from './icons/SafariIcon';
import TurkishFlagIcon from './icons/TurkishFlagIcon';
import USEnglishFlagIcon from './icons/USEnglishFlagIcon';
import VivaldiIcon from './icons/VivaldiIcon';
import WhaleIcon from './icons/WhaleIcon';

interface IconProps {
    name: string;
    size?: number;
    color?: string;
    className?: string;
}

const iconMap: Record<string, React.ElementType> = {
    flagTR: TurkishFlagIcon,
    flagEN: USEnglishFlagIcon,
    flagCN: ChinaFlagIcon,
    chrome: ChromeIcon,
    chromium: ChromiumIcon,
    firefox: FirefoxIcon,
    edge: EdgeIcon,
    opera: OperaIcon,
    safari: SafariIcon,
    vivaldi: VivaldiIcon,
    brave: BraveIcon,
    whale: WhaleIcon,
    download: IconDownload,
    search: IconSearch,
    close: IconX,
    backspace: IconBackspace,
    paste: IconFileImport,
    pin: IconPin,
    pinFilled: IconPinFilled,
    spinner: IconLoader2,
    preferences: IconAdjustmentsHorizontal,
    settings: IconSettings,
    settingsFilled: IconSettingsFilled,
    chevronDown: IconChevronDown,
    chevronsDown: IconChevronsDown,
    fileInfo: IconFileInfo,
};

export default function Icon({ name, size = 20, ...props }: IconProps) {
    const IconComponent = iconMap[name];

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in iconMap.`);
        return null;
    }

    return <IconComponent size={size} {...props} />;
}
