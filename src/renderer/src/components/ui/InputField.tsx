import { useRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import Icon from '../miscellaneous/Icon';
import { cn } from '../../lib/utils';

export type InputFieldSize = 'xs' | 'sm' | 'md';
type InputFieldTruncation = 'start' | 'end' | 'none';

type InputFieldBaseProps = {
  size?: InputFieldSize;
  disabled?: boolean;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  className?: string;
  contentClassName?: string;
};

type InputModeProps = InputFieldBaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'children' | 'disabled' | 'size'> & {
    mode: 'input';
    numberControls?: 'native' | 'custom';
    numberStepFallbackValue?: number;
  };

type TriggerModeProps = InputFieldBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled' | 'size'> & {
    mode: 'trigger';
    children: ReactNode;
    truncate?: InputFieldTruncation;
  };

export type InputFieldProps = InputModeProps | TriggerModeProps;

const sizeClasses: Record<InputFieldSize, string> = {
  xs: 'h-8 px-2 text-xs',
  sm: 'h-9 px-2.5 text-sm',
  md: 'h-10 px-3 py-2 text-sm'
};

const triggerTextClasses: Record<InputFieldTruncation, string> = {
  start:
    'block min-w-0 overflow-hidden whitespace-nowrap text-left text-ellipsis [direction:rtl] [unicode-bidi:plaintext]',
  end: 'block min-w-0 truncate whitespace-nowrap',
  none: 'block min-w-0'
};

function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampNumber(value: number, min?: number, max?: number): number {
  if (min != null) value = Math.max(min, value);
  if (max != null) value = Math.min(max, value);
  return value;
}

export function InputField(props: InputFieldProps): React.JSX.Element {
  const { mode, size = 'md', disabled = false, startAdornment, endAdornment, className } = props;

  const contentClassName = props.contentClassName;
  const rootClassName = cn(
    'flex min-w-0 items-center gap-2 rounded-none border border-white/10 bg-dark text-white/50 transition focus-within:ring-2 focus-within:ring-white/70',
    sizeClasses[size],
    !disabled && 'hover:ring-1 hover:ring-white/25',
    disabled && 'cursor-not-allowed',
    className
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (mode === 'input') {
    const { numberControls = 'native', numberStepFallbackValue, type, onChange, readOnly } = props;
    const showCustomNumberControls = type === 'number' && numberControls === 'custom';

    const inputProps = { ...props } as Record<string, unknown>;
    delete inputProps.mode;
    delete inputProps.size;
    delete inputProps.startAdornment;
    delete inputProps.endAdornment;
    delete inputProps.contentClassName;
    delete inputProps.className;
    delete inputProps.numberControls;
    delete inputProps.numberStepFallbackValue;

    const stepNumber = (direction: 1 | -1): void => {
      const element = inputRef.current;
      if (!element || disabled || readOnly) return;

      const minValue = parseNumericValue(props.min);
      const maxValue = parseNumericValue(props.max);
      const stepValue = parseNumericValue(props.step) ?? 1;
      const currentValue = parseNumericValue(element.value);
      const fallbackValue = Number.isFinite(numberStepFallbackValue)
        ? numberStepFallbackValue
        : undefined;

      let nextValue: number;
      if (currentValue != null) {
        nextValue = currentValue + direction * stepValue;
      } else if (fallbackValue != null) {
        nextValue = fallbackValue + direction * stepValue;
      } else if (minValue != null) {
        nextValue = minValue;
      } else {
        nextValue = 0;
      }

      const clamped = clampNumber(nextValue, minValue, maxValue);
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      valueSetter?.call(element, String(clamped));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.focus();
    };

    return (
      <div className={cn(rootClassName, showCustomNumberControls && 'pr-0')}>
        {startAdornment ? <span className="shrink-0">{startAdornment}</span> : null}
        <input
          {...(inputProps as InputHTMLAttributes<HTMLInputElement>)}
          ref={inputRef}
          type={type}
          disabled={disabled}
          onChange={onChange}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-inherit outline-none placeholder:text-white/50 disabled:cursor-not-allowed',
            showCustomNumberControls &&
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            contentClassName
          )}
        />
        {endAdornment ? <span className="shrink-0">{endAdornment}</span> : null}
        {showCustomNumberControls ? (
          <div className="-my-px -mr-px flex h-[calc(100%+2px)] shrink-0 flex-col border-l border-white/10">
            <button
              type="button"
              className="flex h-1/2 min-h-0 w-6 items-center justify-center border-b border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
              disabled={disabled || readOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => stepNumber(1)}
            >
              <Icon name="chevronDown" size={14} className="shrink-0 rotate-180" />
            </button>
            <button
              type="button"
              className="flex h-1/2 min-h-0 w-6 items-center justify-center bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
              disabled={disabled || readOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => stepNumber(-1)}
            >
              <Icon name="chevronDown" size={14} className="shrink-0" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const { truncate = 'end' } = props;
  const triggerProps = { ...props } as Record<string, unknown>;
  const children = props.children;
  delete triggerProps.mode;
  delete triggerProps.size;
  delete triggerProps.startAdornment;
  delete triggerProps.endAdornment;
  delete triggerProps.contentClassName;
  delete triggerProps.className;
  delete triggerProps.children;
  delete triggerProps.truncate;

  return (
    <div className={rootClassName}>
      {startAdornment ? <span className="shrink-0">{startAdornment}</span> : null}
      <button
        {...(triggerProps as ButtonHTMLAttributes<HTMLButtonElement>)}
        disabled={disabled}
        className={cn(
          'min-w-0 flex-1 cursor-pointer bg-transparent text-left text-inherit outline-none disabled:cursor-not-allowed',
          contentClassName
        )}
      >
        <span className={triggerTextClasses[truncate]}>{children}</span>
      </button>
      {endAdornment ? <span className="shrink-0">{endAdornment}</span> : null}
    </div>
  );
}
