import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Input, InputGroup, InputField, InputText } from './Input';

type LocationSelectorProps = React.ComponentProps<'input'> & {
  label?: string;
  chooseLabel: string;
  labelClassName?: string;
  path?: string;
  fileName?: string;
  suffix?: string;
  displayWhenDisabled?: boolean;
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
  displayWhenDisabled = false,
  onChange,
  onChoose,
  onOpen,
  onReset,
  onBlur
}: LocationSelectorProps): React.JSX.Element {
  const { t } = useTranslation();
  const shouldShowDisabledValue = disabled && displayWhenDisabled;
  const displayedPath =
    shouldShowDisabledValue || !disabled ? path : t('exportSettings.noSavePath');
  const displayedValue = shouldShowDisabledValue || !disabled ? value : '';

  return (
    <div className={cn('flex items-center justify-between w-full gap-16 min-w-0', className)}>
      {label && (
        <legend className={cn('text-sm text-white/50 whitespace-nowrap', labelClassName)}>
          {label}
        </legend>
      )}

      <Input size="sm" className={cn('flex gap-0 divide-x divide-white/10')} disabled={disabled}>
        <InputGroup className="group/location flex-1 gap-0 pl-0 overflow-hidden">
          <Button
            variant="ghost"
            icon="folderOpen"
            className="h-full justify-start"
            label={displayedPath ?? t('exportSettings.noSavePath')}
            size="full-xs"
            iconSize={18}
            onClick={onOpen}
            disabled={disabled}
          />
        </InputGroup>

        <InputGroup align="inline-end" className={cn('gap-0 flex-1')}>
          <Button
            icon="reload"
            variant="ghost"
            size="icon-sm"
            onClick={onReset}
            disabled={disabled || onReset == null}
          />
          <InputField
            className="text-white"
            value={displayedValue}
            placeholder={t('exportSettings.fileNamePlaceholder')}
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
        </InputGroup>
      </Input>
    </div>
  );
}
