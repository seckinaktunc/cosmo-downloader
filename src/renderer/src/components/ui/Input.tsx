import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/utils';

export type InputSize = NonNullable<VariantProps<typeof inputVariants>['size']>;

type InputProps = React.ComponentProps<'div'> &
  VariantProps<typeof inputVariants> & {
    asChild?: boolean;
    tooltip?: string;
    disabled?: boolean;
    rounded?: boolean;
  };

const inputVariants = cva(
  [
    'flex items-center justify-center',
    'bg-gray-950 border border-white/10 bg-clip-padding',
    'focus-within:border-white/25 focus-within:divide-white/25',
    'select-none has-disabled:cursor-not-allowed overflow-hidden'
  ],
  {
    variants: {
      size: {
        default: 'h-11 gap-2 text-sm',
        xs: 'h-8 gap-2 text-sm',
        sm: 'h-10 gap-2 text-sm',
        lg: 'h-12 gap-2 text-base',
        xl: 'h-14 gap-3 text-base'
      }
    },

    defaultVariants: {
      size: 'default'
    }
  }
);

const inputGroupVariants = cva(
  'flex h-full shrink-0 items-center gap-2 bg-transparent select-none',
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-2 has-[>button]:pl-0',
        'inline-end': 'order-last pr-2 has-[>button]:pr-0',
        'block-start': 'order-first w-full justify-start px-2.5 pt-2',
        'block-end': 'order-last w-full justify-start px-2.5 pb-2'
      }
    },
    defaultVariants: {
      align: 'inline-start'
    }
  }
);

function Input({
  className,
  size,
  disabled = false,
  rounded = false,
  ...props
}: InputProps): React.JSX.Element {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        inputVariants({ size }),
        'group/input-group relative flex w-full min-w-0 items-center disabled:opacity-25 has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3',
        !disabled && 'hover:border-white/25 hover:divide-white/25',
        rounded && 'rounded-lg',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      {...props}
    />
  );
}

function InputGroup({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupVariants>): React.JSX.Element {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn('bg-transparent', inputGroupVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return;
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus();
      }}
      {...props}
    />
  );
}

function InputText({ className, ...props }: React.ComponentProps<'span'>): React.JSX.Element {
  return (
    <span className={cn('flex items-center gap-2 text-sm text-white/50', className)} {...props} />
  );
}

function InputField({
  className,
  disabled = false,
  ...props
}: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      data-slot="input-group-control"
      className={cn(
        'w-full h-full min-w-0 truncate outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 read-only:text-white/50',
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}

export { Input, InputGroup, InputText, InputField };
