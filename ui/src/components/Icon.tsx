import { IconAdjustmentsHorizontal, IconBackspace, IconChevronsDown, IconDownload, IconFileImport, IconLoader2, IconPin, IconPinFilled, IconSettings, IconSettingsFilled, IconX } from '@tabler/icons-react';
import React from 'react';

interface IconProps {
    name: string;
    size?: number;
    color?: string;
    className?: string;
}

const iconMap: Record<string, React.ElementType> = {
    download: IconDownload,
    close: IconX,
    backspace: IconBackspace,
    paste: IconFileImport,
    pin: IconPin,
    pinFilled: IconPinFilled,
    spinner: IconLoader2,
    preferences: IconAdjustmentsHorizontal,
    settings: IconSettings,
    settingsFilled: IconSettingsFilled,
    chevronsDown: IconChevronsDown,
};

export default function Icon({ name, size = 20, ...props }: IconProps) {
    const IconComponent = iconMap[name];

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in iconMap.`);
        return null;
    }

    return <IconComponent size={size} {...props} />;
}