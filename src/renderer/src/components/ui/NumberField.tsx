import React from 'react';
import { Input, InputAddon, InputField, InputText } from './InputGroup';
import Button from './Button';

const DRAG_ACTIVATION_PX = 6;
const DRAG_STEP_PX = 12;

type NumberFieldProps = React.ComponentProps<'input'> & {
  suffix?: string;
  onCommit?: (value: string) => void;
};

export default function NumberField({
  suffix,
  min,
  max,
  step,
  value,
  disabled = false,
  onFocus,
  onChange,
  onBlur,
  onKeyDown,
  onCommit,
  ...props
}: NumberFieldProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const holdTimeoutRef = React.useRef<number | null>(null);
  const holdIntervalRef = React.useRef<number | null>(null);
  const hasPendingStepCommitRef = React.useRef(false);
  const skipBlurCommitRef = React.useRef(false);
  const activePointerIdRef = React.useRef<number | null>(null);
  const dragStartYRef = React.useRef<number | null>(null);
  const dragAppliedStepsRef = React.useRef(0);
  const draggingRef = React.useRef(false);

  const commitValue = (nextValue?: string): void => {
    const resolvedValue = nextValue ?? inputRef.current?.value;
    if (resolvedValue == null) return;
    onCommit?.(resolvedValue);
  };

  const changeValue = (direction: 1 | -1): boolean => {
    const input = inputRef.current;
    if (!input || disabled) return false;

    const previousValue = input.value;
    const currentValue = Number(input.value);
    const fallbackValue = min == null ? 0 : Number(min);

    if (Number.isNaN(currentValue)) input.value = String(fallbackValue);

    if (direction === 1) input.stepUp();
    else input.stepDown();

    if (input.value === previousValue) return false;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };

  const stopHoldTimers = (): void => {
    if (holdTimeoutRef.current != null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current != null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startChangingValue = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: 1 | -1
  ): void => {
    event.preventDefault();
    if (disabled) return;

    stopChangingValue();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    dragStartYRef.current = event.clientY;
    dragAppliedStepsRef.current = 0;
    draggingRef.current = false;

    hasPendingStepCommitRef.current = changeValue(direction);

    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        hasPendingStepCommitRef.current = changeValue(direction) || hasPendingStepCommitRef.current;
      }, 70);
    }, 350);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.pointerId !== activePointerIdRef.current || dragStartYRef.current == null) {
      return;
    }

    const dragDistance = dragStartYRef.current - event.clientY;
    if (!draggingRef.current) {
      if (Math.abs(dragDistance) < DRAG_ACTIVATION_PX) {
        return;
      }

      draggingRef.current = true;
      stopHoldTimers();
    }

    const dragSteps = Math.trunc(dragDistance / DRAG_STEP_PX);
    const stepDelta = dragSteps - dragAppliedStepsRef.current;
    if (stepDelta === 0) {
      return;
    }

    const stepDirection = stepDelta > 0 ? 1 : -1;
    for (let index = 0; index < Math.abs(stepDelta); index += 1) {
      hasPendingStepCommitRef.current =
        changeValue(stepDirection) || hasPendingStepCommitRef.current;
    }

    dragAppliedStepsRef.current = dragSteps;
  };

  const stopChangingValue = (): void => {
    stopHoldTimers();
    activePointerIdRef.current = null;
    dragStartYRef.current = null;
    dragAppliedStepsRef.current = 0;
    draggingRef.current = false;

    if (hasPendingStepCommitRef.current) {
      hasPendingStepCommitRef.current = false;
      commitValue();
    }
  };

  React.useEffect(() => {
    return () => {
      stopHoldTimers();
    };
  }, []);

  return (
    <Input size="sm" className="gap-0 divide-x divide-white/10">
      <InputAddon align="inline-start" className="pr-2 gap-0">
        <InputField
          ref={inputRef}
          className="[&::-webkit-inner-spin-button]:appearance-none text-right pr-2"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          maxLength={4}
          value={value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={onChange}
          onBlur={(event) => {
            onBlur?.(event);
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }
            commitValue(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (event.key === 'Enter') {
              skipBlurCommitRef.current = true;
              commitValue(event.currentTarget.value);
              event.currentTarget.blur();
            }
          }}
          {...props}
        />
        {suffix && <InputText>{suffix}</InputText>}
      </InputAddon>
      <InputAddon align="inline-end" className="flex-col gap-0">
        <Button
          variant="secondary"
          icon="chevronUp"
          size="icon-xs"
          className="flex-1 border-0 cursor-ns-resize touch-none"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail !== 0) return;
            if (changeValue(1)) commitValue();
          }}
          onPointerDown={(event) => startChangingValue(event, 1)}
          onPointerMove={handlePointerMove}
          onPointerUp={stopChangingValue}
          onPointerCancel={stopChangingValue}
          onLostPointerCapture={stopChangingValue}
        />
        <Button
          variant="secondary"
          icon="chevronDown"
          size="icon-xs"
          className="flex-1 border-0 border-t cursor-ns-resize touch-none"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail !== 0) return;
            if (changeValue(-1)) commitValue();
          }}
          onPointerDown={(event) => startChangingValue(event, -1)}
          onPointerMove={handlePointerMove}
          onPointerUp={stopChangingValue}
          onPointerCancel={stopChangingValue}
          onLostPointerCapture={stopChangingValue}
        />
      </InputAddon>
    </Input>
  );
}
