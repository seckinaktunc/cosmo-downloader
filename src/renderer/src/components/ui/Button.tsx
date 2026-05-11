import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import Icon, { IconName } from '../miscellaneous/Icon';
import { useEffect, useRef, useState } from 'react';
import { Tooltip } from './Tooltip';

export type ButtonSize = NonNullable<React.ComponentProps<typeof Button>['size']>;

const buttonVariants = cva(
  [
    'group/button relative inline-flex shrink-0 items-center justify-center',
    'border border-transparent whitespace-nowrap overflow-hidden cursor-pointer',
    'focus-visible:ring-2 focus-visible:ring-white/70',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'duration-300 hover:duration-0',
    '[&_[data-slot=label]]:transition-colors',
    '[&_[data-slot=label]]:duration-300',
    'hover:[&_[data-slot=label]]:duration-0',
    '[&_[data-slot=icon]]:transition-opacity',
    '[&_[data-slot=icon]]:duration-300',
    'hover:[&_[data-slot=icon]]:duration-0'
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-white text-black',
        secondary:
          'bg-white/5 [&_[data-slot=label]]:text-white/50 [&_[data-slot=icon]]:opacity-50 border border-white/10 hover:bg-white/10 hover:[&_[data-slot=icon]]:opacity-100',
        ghost:
          '[&_[data-slot=label]]:text-white/50 [&_[data-slot=icon]]:opacity-50 hover:[&_[data-slot=label]]:text-white hover:[&_[data-slot=icon]]:opacity-100',
        link: 'text-white underline-offset-2 hover:underline'
      },
      size: {
        default: 'h-11 px-3 gap-2 [&_[data-slot=label]]:text-sm',
        xs: 'h-8 px-2 gap-2 [&_[data-slot=label]]:text-sm',
        sm: 'h-10 px-2.5 gap-2 [&_[data-slot=label]]:text-base',
        lg: 'h-12 px-4 gap-2 [&_[data-slot=label]]:text-base',
        xl: 'h-14 px-4 gap-3 [&_[data-slot=label]]:text-base',

        full: 'h-11 w-full px-3 gap-2 [&_[data-slot=label]]:text-sm',
        'full-xs': 'h-8 w-full px-2 gap-2 [&_[data-slot=label]]:text-sm',
        'full-sm': 'h-10 w-full px-2.5 gap-2 [&_[data-slot=label]]:text-base',
        'full-lg': 'h-12 w-full px-4 gap-2 [&_[data-slot=label]]:text-base',
        'full-xl': 'h-14 w-full px-4 gap-3 [&_[data-slot=label]]:text-base',

        auto: 'h-auto w-auto p-0 gap-1 [&_[data-slot=label]]:text-sm',
        'auto-xs': 'h-auto w-auto p-0 gap-1 [&_[data-slot=label]]:text-xs',
        'auto-sm': 'h-auto w-auto p-0 gap-1.5 [&_[data-slot=label]]:text-xs',
        'auto-lg': 'h-auto w-auto p-0 gap-2 [&_[data-slot=label]]:text-sm',
        'auto-xl': 'h-auto w-auto p-0 gap-2.5 [&_[data-slot=label]]:text-base',

        icon: 'size-11',
        'icon-xs': 'size-8',
        'icon-sm': 'size-10',
        'icon-lg': 'size-12',
        'icon-xl': 'size-14'
      },
      isActive: {
        true: '',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
      isActive: false
    },
    compoundVariants: [
      {
        variant: 'secondary',
        isActive: true,
        class: 'bg-white text-black hover:bg-white border-white/20 [&_[data-slot=label]]:text-black'
      },
      {
        variant: 'ghost',
        isActive: true,
        class: '[&_[data-slot=icon]]:opacity-100 [&_[data-slot=label]]:text-white'
      }
    ]
  }
);

const iconSizeMap = {
  xs: 16,
  sm: 18,
  default: 20,
  lg: 20,
  xl: 22,

  'icon-full': 20,
  'icon-full-xs': 16,
  'icon-full-sm': 18,
  'icon-full-lg': 22,
  'icon-full-xl': 24,

  auto: 16,
  'auto-xs': 14,
  'auto-sm': 14,
  'auto-lg': 16,
  'auto-xl': 18,

  icon: 20,
  'icon-xs': 16,
  'icon-sm': 18,
  'icon-lg': 22,
  'icon-xl': 24
} as const;

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    icon?: IconName;
    iconPosition?: 'start' | 'end';
    label?: React.ReactNode;
    tooltip?: string;
    rounded?: boolean;
    ripple?: boolean;
    isActive?: boolean;
  };

const RIPPLE_DURATION_MS = 600;

function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  icon,
  iconPosition = 'start',
  label,
  tooltip,
  rounded = false,
  ripple = false,
  isActive = false,
  children,
  onClick,
  ...props
}: ButtonProps): React.JSX.Element {
  const Comp = asChild ? Slot : 'button';
  const resolvedSize = size ?? (variant === 'link' ? 'auto' : 'default');
  const isIconOnly = String(resolvedSize).startsWith('icon');
  const iconSize = iconSizeMap[resolvedSize ?? 'default'];
  const isDisabled = props.disabled === true;

  const [buttonRipples, setButtonRipples] = useState<
    Array<{ x: number; y: number; size: number; key: number }>
  >([]);
  const rippleKeyRef = useRef(0);
  const rippleTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const triggeredByKeyboard = event.detail === 0;
    const x = triggeredByKeyboard
      ? rect.width / 2 - size / 2
      : event.clientX - rect.left - size / 2;
    const y = triggeredByKeyboard
      ? rect.height / 2 - size / 2
      : event.clientY - rect.top - size / 2;

    const rippleKey = rippleKeyRef.current++;
    const newRipple = { x, y, size, key: rippleKey };
    setButtonRipples((prevRipples) => [...prevRipples, newRipple]);

    const timeout = setTimeout(() => {
      setButtonRipples((prevRipples) =>
        prevRipples.filter((existingRipple) => existingRipple.key !== rippleKey)
      );
      rippleTimeoutsRef.current = rippleTimeoutsRef.current.filter(
        (existingTimeout) => existingTimeout !== timeout
      );
    }, RIPPLE_DURATION_MS);

    rippleTimeoutsRef.current.push(timeout);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (ripple) {
      createRipple(event);
    }

    onClick?.(event);
  };

  useEffect(() => {
    return () => {
      rippleTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      rippleTimeoutsRef.current = [];
    };
  }, []);

  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={resolvedSize}
      data-active={isActive ? 'true' : undefined}
      data-icon={icon ? 'inline-start' : undefined}
      data-label={label}
      className={cn(
        buttonVariants({ variant, size: resolvedSize, isActive, className }),
        rounded && 'rounded-lg'
      )}
      onClick={handleClick}
      {...props}
    >
      {ripple ? (
        <span className="pointer-events-none absolute inset-0">
          {buttonRipples.map((rippleItem) => (
            <span
              className={cn(
                'animate-rippling absolute rounded-full',
                variant === 'primary' || (isActive && variant !== 'ghost')
                  ? 'bg-black/25'
                  : 'bg-white/25'
              )}
              key={rippleItem.key}
              style={
                {
                  width: `${rippleItem.size}px`,
                  height: `${rippleItem.size}px`,
                  top: `${rippleItem.y}px`,
                  left: `${rippleItem.x}px`,
                  transform: 'scale(0)',
                  '--duration': `${RIPPLE_DURATION_MS}ms`
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      ) : null}
      <span
        className={cn(
          iconPosition === 'start' ? 'flex-row' : 'flex-row-reverse',
          'relative z-10 inline-flex items-center justify-center gap-[inherit]'
        )}
      >
        {icon && (
          <span data-slot="icon">
            <Icon name={icon} size={iconSize} />
          </span>
        )}
        {children ?? (!isIconOnly && <span data-slot="label">{label}</span>)}
      </span>
    </Comp>
  );

  if (!tooltip) return button;

  return isDisabled ? (
    <Tooltip label={tooltip}>{button}</Tooltip>
  ) : (
    <Tooltip asChild label={tooltip}>
      {button}
    </Tooltip>
  );
}

export { Button };
export default Button;
