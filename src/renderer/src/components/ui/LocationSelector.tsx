import type { KeyboardEvent } from 'react';
import Icon, { type IconName } from '../miscellaneous/Icon';
import { Button } from './Button';
import { cn } from '../../lib/utils';
import { InputField } from './InputField';

type LocationSelectorMode = 'directory' | 'file';

type EditableFilePathProps = {
  leadingPath: string;
  editableBasename: string;
  trailingSuffix: string;
  onEditableBasenameChange: (value: string) => void;
  onEditableBasenameCommit: () => void;
};

type LocationSelectorProps = {
  mode: LocationSelectorMode;
  label?: string;
  value?: string;
  placeholder: string;
  chooseLabel: string;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  pathClassName?: string;
  layout?: 'inline' | 'stacked';
  buttonSize?: 'xs' | 'sm' | 'lg';
  editableFilePath?: EditableFilePathProps;
  onChoose: () => void;
  onOpen: () => void;
};

const leadingPathClasses =
  'block min-w-0 overflow-hidden whitespace-nowrap text-left text-ellipsis [direction:rtl] [unicode-bidi:plaintext]';

export function LocationSelector({
  mode,
  label,
  value,
  placeholder,
  chooseLabel,
  icon = mode === 'directory' ? 'folder' : 'folderOpen',
  disabled = false,
  className,
  labelClassName,
  pathClassName,
  layout = 'inline',
  buttonSize = 'sm',
  editableFilePath,
  onChoose,
  onOpen
}: LocationSelectorProps): React.JSX.Element {
  const pathDisabled = disabled || !value;
  const hasEditableFilePath = mode === 'file' && value != null && editableFilePath != null;

  const handleEditableBasenameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const pathButton = hasEditableFilePath ? (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-none border border-white/10 bg-dark text-white/50 transition focus-within:ring-2 focus-within:ring-white/70',
        'h-10 px-3 py-2 text-sm',
        !pathDisabled && 'hover:ring-1 hover:ring-white/25',
        pathDisabled && 'cursor-not-allowed',
        className,
        'flex-1 border-r-0 cursor-pointer',
        pathClassName
      )}
    >
      <Icon name={icon} className="shrink-0" />
      {editableFilePath.leadingPath.length > 0 ? (
        <button
          type="button"
          disabled={pathDisabled}
          title={value}
          className="min-w-0 cursor-pointer text-left text-inherit outline-none disabled:cursor-not-allowed"
          onClick={onOpen}
        >
          <span className={leadingPathClasses}>{editableFilePath.leadingPath}</span>
        </button>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <input
        type="text"
        disabled={pathDisabled}
        value={editableFilePath.editableBasename}
        aria-label={label ?? placeholder}
        className="min-w-[4ch] shrink-0 bg-white/20 text-white outline-none disabled:cursor-not-allowed"
        onChange={(event) => editableFilePath.onEditableBasenameChange(event.target.value)}
        onBlur={editableFilePath.onEditableBasenameCommit}
        onKeyDown={handleEditableBasenameKeyDown}
        dir="rtl"
      />
      {editableFilePath.trailingSuffix.length > 0 ? (
        <button
          type="button"
          disabled={pathDisabled}
          title={value}
          className="shrink-0 cursor-pointer text-white/50 outline-none transition hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
          onClick={onOpen}
        >
          {editableFilePath.trailingSuffix}
        </button>
      ) : null}
    </div>
  ) : (
    <InputField
      mode="trigger"
      size="md"
      disabled={pathDisabled}
      truncate="start"
      startAdornment={<Icon name={icon} className="shrink-0" />}
      className={cn('flex-1 border-r-0', pathClassName)}
      onClick={onOpen}
    >
      {value ?? placeholder}
    </InputField>
  );

  const chooseButton = (
    <Button
      variant="secondary"
      type="button"
      size={buttonSize}
      icon="folder"
      label={chooseLabel}
      className="rounded-none border-l-0"
      isActive={false}
      disabled={disabled}
      onClick={onChoose}
      ripple
    />
  );

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col gap-1', className, disabled && 'opacity-40')}>
        {label && <legend className={cn('text-sm text-white/50', labelClassName)}>{label}</legend>}
        <div className="flex">
          {pathButton}
          {chooseButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-16 min-w-0',
        className,
        disabled && 'opacity-40'
      )}
    >
      {label && <legend className={cn('text-sm text-white/50', labelClassName)}>{label}</legend>}
      <div className="flex min-w-0 flex-1 items-center">
        {pathButton}
        {chooseButton}
      </div>
    </div>
  );
}
