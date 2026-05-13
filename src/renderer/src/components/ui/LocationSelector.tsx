import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Input, InputAddon, InputField, InputText } from './InputGroup';

type LocationSelectorProps = React.ComponentProps<'input'> & {
  mode: 'directory' | 'file';
  label?: string;
  chooseLabel: string;
  labelClassName?: string;
  layout?: 'inline' | 'stacked';
  path?: string;
  fileName?: string;
  suffix?: string;
  onChoose: () => void;
  onOpen: () => void;
};

export function LocationSelector({
  mode,
  label,
  value,
  placeholder,
  chooseLabel,
  disabled = false,
  className,
  labelClassName,
  layout = 'inline',
  path,
  suffix,
  onChange,
  onChoose,
  onOpen,
  onBlur
}: LocationSelectorProps): React.JSX.Element {
  const directorySelector = (
    <InputAddon className="flex-1 gap-0 overflow-hidden">
      <Button variant="ghost" icon="folderOpen" size="icon" onClick={onOpen} />
      <InputField
        className="block min-w-0 overflow-hidden truncate"
        placeholder={placeholder}
        value={mode === 'directory' ? value : path}
        readOnly={mode === 'file'}
        disabled={mode === 'file'}
      />
    </InputAddon>
  );

  const chooseButton = (
    <Button
      icon="folder"
      label={chooseLabel}
      variant="secondary"
      className="h-full border-0 border-l"
      onClick={onChoose}
      size="sm"
    />
  );

  const fileSelector = (
    <>
      <Button icon="reload" variant="ghost" size="icon" />
      <InputField
        className="text-white"
        value={value}
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
      <InputText className="pr-2">{suffix}</InputText>
      {chooseButton}
    </>
  );

  const selector = (
    <Input size="sm" className={cn('flex gap-0', mode === 'file' && 'divide-x divide-white/10')}>
      {directorySelector}

      <InputAddon
        align="inline-end"
        className={cn('gap-0', mode === 'file' ? 'flex-1' : 'flex-none shrink-0')}
      >
        {mode === 'file' ? fileSelector : chooseButton}
      </InputAddon>
    </Input>
  );

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col w-full gap-1', className)}>
        {label && (
          <legend className={cn('text-sm text-white/50 whitespace-nowrap', labelClassName)}>
            {label}
          </legend>
        )}
        {selector}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between w-full gap-16 min-w-0', className)}>
      {label && (
        <legend className={cn('text-sm text-white/50 whitespace-nowrap', labelClassName)}>
          {label}
        </legend>
      )}
      {selector}
    </div>
  );
}
