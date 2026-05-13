import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Input, InputAddon, InputField, InputText } from './InputGroup';

type LocationSelectorProps = React.ComponentProps<'input'> & {
  label?: string;
  chooseLabel: string;
  labelClassName?: string;
  path?: string;
  fileName?: string;
  suffix?: string;
  onChoose: () => void;
  onOpen: () => void;
  onReset?: () => void;
};

export function LocationSelector({
  label,
  value,
  chooseLabel,
  disabled = false,
  className,
  labelClassName,
  path,
  suffix,
  onChange,
  onChoose,
  onOpen,
  onReset,
  onBlur
}: LocationSelectorProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={cn('flex items-center justify-between w-full gap-16 min-w-0', className)}>
      {label && (
        <legend className={cn('text-sm text-white/50 whitespace-nowrap', labelClassName)}>
          {label}
        </legend>
      )}

      <Input size="sm" className={cn('flex gap-0 divide-x divide-white/10')} disabled={disabled}>
        <InputAddon className="group/location flex-1 gap-0 pl-0 overflow-hidden">
          <Button
            variant="ghost"
            icon="folderOpen"
            className="h-full justify-start"
            label={disabled ? t('exportSettings.noSavePath') : path}
            size="full-xs"
            iconSize={18}
            onClick={onOpen}
            disabled={disabled}
          />
        </InputAddon>

        <InputAddon align="inline-end" className={cn('gap-0 flex-1')}>
          <Button
            icon="reload"
            variant="ghost"
            size="icon-sm"
            onClick={onReset}
            disabled={disabled || onReset == null}
          />
          <InputField
            className="text-white"
            value={disabled ? '' : value}
            placeholder={'Enter a file name'}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          <InputText className="px-2">{suffix}</InputText>
          <Button
            icon="folder"
            label={chooseLabel}
            variant="secondary"
            className="h-full border-0 border-l"
            onClick={onChoose}
            size="sm"
            disabled={disabled}
            ripple
          />
        </InputAddon>
      </Input>
    </div>
  );
}
