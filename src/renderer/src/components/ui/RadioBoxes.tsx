import { cn } from '../../lib/utils';
import Icon, { type IconName } from '../miscellaneous/Icon';
import { Tooltip } from './Tooltip';

type RadioBoxesProps<T extends string> = {
  label?: string;
  value: T;
  options: Array<{
    value: T;
    label: string;
    icon?: IconName;
    disabled?: boolean;
    tooltip?: string;
    disabledReason?: string;
  }>;
  className?: string;
  disabled?: boolean;
  onChange: (value: T) => void;
};

export function RadioBoxes<T extends string>({
  label,
  value,
  options,
  className,
  disabled = false,
  onChange
}: RadioBoxesProps<T>): React.JSX.Element {
  return (
    <fieldset className="space-y-2" aria-disabled={disabled || undefined}>
      {label && (
        <legend className={cn('text-sm font-medium', disabled ? 'text-white/30' : 'text-white/50')}>
          {label}
        </legend>
      )}
      <div className={cn('grid grid-cols-6 h-auto gap-2', className)}>
        {options.map((option) => {
          const optionDisabled = disabled || option.disabled;
          const tooltipLabel =
            (option.disabled || option.disabledReason) && !disabled
              ? option.disabledReason
              : option.tooltip;

          const optionNode = (
            <label
              key={option.value}
              className={cn(
                'flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm font-semibold uppercase h-16',
                value === option.value
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white',
                optionDisabled && 'cursor-not-allowed opacity-40'
              )}
            >
              <input
                type="radio"
                className="sr-only"
                disabled={optionDisabled}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              {option.icon ? <Icon name={option.icon} size={16} /> : null}
              {option.label}
            </label>
          );

          return tooltipLabel ? (
            <Tooltip key={option.value} label={tooltipLabel}>
              {optionNode}
            </Tooltip>
          ) : (
            optionNode
          );
        })}
      </div>
    </fieldset>
  );
}
