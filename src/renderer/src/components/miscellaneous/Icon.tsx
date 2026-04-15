import {
    IconAdjustmentsHorizontal,
    IconAdjustmentsHorizontalFilled,
    IconArrowRight,
    IconCheck,
    IconChevronDown,
    IconChevronsDown,
    IconClock,
    IconCopy,
    IconDownload,
    IconExclamationCircle,
    IconHeart,
    IconHistory,
    IconInfoCircle,
    IconList,
    IconLoader2,
    IconMusic,
    IconSettings,
    IconSettingsFilled,
    IconSmartHome,
    IconTrashX,
    IconVideo,
    IconVideoFilled,
    IconX
} from '@tabler/icons-react';

interface IconProps {
    name: IconName;
    size?: number;
    color?: string;
    className?: string;
    style?: React.CSSProperties;
    filled?: boolean;
}

const iconMap = {
    home: IconSmartHome,
    video: IconVideo,
    videoFilled: IconVideoFilled,
    music: IconMusic,
    settings: IconSettings,
    settingsFilled: IconSettingsFilled,
    copy: IconCopy,
    check: IconCheck,
    trash: IconTrashX,
    warning: IconExclamationCircle,
    heart: IconHeart,
    close: IconX,
    download: IconDownload,
    clock: IconClock,
    spinner: IconLoader2,
    arrowRight: IconArrowRight,
    chevronDown: IconChevronDown,
    chevronsDown: IconChevronsDown,
    adjustments: IconAdjustmentsHorizontal,
    adjustmentsFilled: IconAdjustmentsHorizontalFilled,
    history: IconHistory,
    list: IconList,
    info: IconInfoCircle,
} as const;

export type IconName = keyof typeof iconMap;

export default function Icon({ name, size = 20, style, filled = false, ...props }: IconProps) {
    const filledName = `${name}Filled` as IconName;
    const resolvedName =
        filled && iconMap[filledName]
            ? filledName
            : name;

    const IconComponent = iconMap[resolvedName];

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in iconMap.`);
        return null;
    }

    return (
        <IconComponent
            style={{
                width: `${size / 16}rem`,
                height: `${size / 16}rem`,
                ...style
            }}
            {...props}
        />
    );
}
