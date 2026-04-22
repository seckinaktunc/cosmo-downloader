import { icons as logos } from '@iconify-json/logos'
import { icons as flags } from '@iconify-json/flag'
import { Icon as IconifyIcon, addCollection } from '@iconify/react'
import {
  IconAdjustmentsHorizontal,
  IconAdjustmentsHorizontalFilled,
  IconAlertTriangle,
  IconArrowRight,
  IconBrandChrome,
  IconBrandEdge,
  IconBrandFirefox,
  IconBrandOpera,
  IconBrandSafari,
  IconBrandVivaldi,
  IconBrowser,
  IconCheck,
  IconChevronDown,
  IconChevronsDown,
  IconCircleOff,
  IconClipboardText,
  IconClock,
  IconCopy,
  IconDotsVerticalFilled,
  IconDownload,
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
  IconHeart,
  IconHistory,
  IconInfoCircle,
  IconLanguage,
  IconList,
  IconLoader2,
  IconLogs,
  IconMinus,
  IconMusic,
  IconPinFilled,
  IconPinned,
  IconPlayerStop,
  IconReload,
  IconSearch,
  IconSettings,
  IconSettingsFilled,
  IconSmartHome,
  IconSquare,
  IconSquarePlus,
  IconTrashX,
  IconVideo,
  IconVideoFilled,
  IconWorld,
  IconX
} from '@tabler/icons-react'
import AppIcon from './AppIcon'
import { cn } from '@renderer/lib/utils'

export interface IconProps {
  name: IconName
  size?: number
  thickness?: number
  color?: string
  className?: string
  style?: React.CSSProperties
  filled?: boolean
}

addCollection(logos)
addCollection(flags)

const iconMap = {
  appIcon: AppIcon,
  home: IconSmartHome,
  video: IconVideo,
  videoFilled: IconVideoFilled,
  music: IconMusic,
  settings: IconSettings,
  settingsFilled: IconSettingsFilled,
  copy: IconCopy,
  paste: IconClipboardText,
  check: IconCheck,
  trash: IconTrashX,
  heart: IconHeart,
  close: IconX,
  download: IconDownload,
  clock: IconClock,
  spinner: IconLoader2,
  stop: IconPlayerStop,
  minus: IconMinus,
  square: IconSquare,
  folder: IconFolder,
  arrowRight: IconArrowRight,
  brandChrome: IconBrandChrome,
  brandEdge: IconBrandEdge,
  brandFirefox: IconBrandFirefox,
  brandOpera: IconBrandOpera,
  brandSafari: IconBrandSafari,
  brandVivaldi: IconBrandVivaldi,
  browser: IconBrowser,
  chevronDown: IconChevronDown,
  chevronsDown: IconChevronsDown,
  adjustments: IconAdjustmentsHorizontal,
  adjustmentsFilled: IconAdjustmentsHorizontalFilled,
  history: IconHistory,
  language: IconLanguage,
  list: IconList,
  info: IconInfoCircle,
  warning: IconAlertTriangle,
  world: IconWorld,
  pin: IconPinned,
  pinFilled: IconPinFilled,
  external: IconExternalLink,
  add: IconSquarePlus,
  reload: IconReload,
  search: IconSearch,
  move: IconDotsVerticalFilled,
  folderOpen: IconFolderOpen,
  none: IconCircleOff,
  logs: IconLogs
} as const

export type TablerIconName = keyof typeof iconMap
export type LogoIconName = `logos:${string}`
export type FlagIconName = `flag:${string}`

export type IconName = TablerIconName | LogoIconName | FlagIconName

export default function Icon({
  name,
  size = 20,
  thickness = 2,
  style,
  filled = false,
  color,
  className
}: IconProps): React.JSX.Element | null {
  if (name.startsWith('logos:') || name.startsWith('flag:')) {
    return (
      <IconifyIcon
        icon={name}
        className={className}
        style={{
          width: `${size / 16}rem`,
          height: `${size / 16}rem`,
          color,
          ...style
        }}
      />
    )
  }

  const filledName = `${name}Filled` as TablerIconName
  const resolvedName = filled && filledName in iconMap ? filledName : name

  const IconComponent = iconMap[resolvedName as TablerIconName]

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap.`)
    return null
  }

  return (
    <IconComponent
      stroke={thickness}
      color={color}
      className={cn(resolvedName === 'spinner' && 'animate-spin', className)}
      style={{
        width: `${size / 16}rem`,
        height: `${size / 16}rem`,
        ...style
      }}
    />
  )
}
