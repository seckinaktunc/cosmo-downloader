import {
  IconAdjustmentsHorizontal,
  IconAdjustmentsHorizontalFilled,
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
  IconClock,
  IconCopy,
  IconDownload,
  IconExclamationCircle,
  IconExternalLink,
  IconFolder,
  IconHeart,
  IconHistory,
  IconInfoCircle,
  IconLanguage,
  IconList,
  IconLoader2,
  IconMinus,
  IconMusic,
  IconPinFilled,
  IconPinned,
  IconPlayerStop,
  IconReload,
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

interface IconProps {
  name: IconName
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
  filled?: boolean
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
  world: IconWorld,
  pin: IconPinned,
  pinFilled: IconPinFilled,
  external: IconExternalLink,
  add: IconSquarePlus,
  reload: IconReload,
} as const

export type IconName = keyof typeof iconMap

export default function Icon({
  name,
  size = 20,
  style,
  filled = false,
  ...props
}: IconProps): React.JSX.Element | null {
  const filledName = `${name}Filled` as IconName
  const resolvedName = filled && iconMap[filledName] ? filledName : name

  const IconComponent = iconMap[resolvedName]

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap.`)
    return null
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
  )
}
