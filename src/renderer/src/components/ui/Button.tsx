import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from '../miscellaneous/Icon'
import { cn } from '../../lib/utils'
import { Tooltip } from './Tooltip'

type ButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName
  label?: string
  size?: ButtonSize
  active?: boolean
  tooltip?: string
  onlyLabel?: boolean
  onlyIcon?: boolean
  ghost?: boolean
  children?: ReactNode
}

const sizeClasses: Record<ButtonSize, { base: string; square: string; icon: number }> = {
  xl: { base: 'h-14 px-4 gap-3 text-base', square: 'size-14', icon: 26 },
  lg: { base: 'h-12 px-4 text-sm', square: 'size-12', icon: 24 },
  md: { base: 'h-11 px-3 text-sm', square: 'size-11', icon: 22 },
  sm: { base: 'h-10 px-2.5 text-xs', square: 'size-10', icon: 20 },
  xs: { base: 'h-8 px-2 text-xs', square: 'size-8', icon: 18 }
}

export function Button({
  icon,
  label,
  size = 'md',
  active = false,
  tooltip,
  onlyLabel = false,
  onlyIcon = false,
  ghost = false,
  className,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const resolvedSize = sizeClasses[size]
  const showIcon = icon != null && !onlyLabel
  const showLabel = !onlyIcon
  const button = (
    <button
      type="button"
      aria-label={onlyIcon ? label : undefined}
      className={cn(
        'group cursor-pointer no-drag inline-flex items-center justify-center gap-2 rounded-lg text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40',
        onlyIcon ? resolvedSize.square : resolvedSize.base,
        ghost
          ? 'bg-transparent opacity-50 hover:bg-transparent hover:opacity-100'
          : 'bg-white/5 hover:bg-white/10 border border-white/10',
        active && !ghost && 'bg-white text-black hover:bg-white',
        active && ghost && 'opacity-100',
        active && 'opacity-100',
        className
      )}
      {...props}
    >
      {showIcon ? (
        <Icon
          name={icon}
          size={resolvedSize.icon}
          className={cn(
            active && !ghost ? undefined : 'opacity-50 text-white group-hover:opacity-100'
          )}
        />
      ) : null}
      {showLabel ? (
        <span className={cn('min-w-0', children == null && 'truncate', !active && 'text-white/50')}>
          {children ?? label}
        </span>
      ) : null}
    </button>
  )

  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button
}
