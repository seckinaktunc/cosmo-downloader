import { cn } from '../../lib/utils';
import type { InputFieldSize } from './InputField';

const sizeClasses: Record<InputFieldSize, string> = {
  xs: 'h-8 px-2 text-xs',
  sm: 'h-9 px-2.5 text-sm',
  md: 'h-10 px-3 py-2 text-sm'
};

export function getInputFieldRootClassName({
  size = 'md',
  disabled = false,
  className
}: {
  size?: InputFieldSize;
  disabled?: boolean;
  className?: string;
}): string {
  return cn(
    'flex min-w-0 items-center gap-2 rounded-none border border-white/10 bg-dark text-white/50 transition focus-within:ring-2 focus-within:ring-white/70',
    sizeClasses[size],
    !disabled && 'hover:ring-1 hover:ring-white/25',
    disabled && 'cursor-not-allowed',
    className
  );
}
