import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/Icon";
import { cn } from "@/utils/cn";
import Button from "./Button";
import type { ClassValue } from "clsx";

export interface DropdownOption {
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
}

interface DropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    buttonClassName?: ClassValue;
    menuClassName?: ClassValue;
}

const baseOptionStyles = "flex items-center gap-2 h-9 p-2 w-full";
const buttonVariantStyles = "text-white/50 bg-white/5 border-white/25 shadow-white/25 hover:bg-white/15 hover:border-white/35 hover:text-white";
const buttonDisabledStyles = "border border-white/10 bg-white/5 text-white/20 cursor-not-allowed grayscale shadow-none";
const buttonActiveStyles = "border-white/25 bg-white/15 text-white shadow-white/25";

export default function Dropdown({
    options,
    value,
    onChange,
    placeholder = "",
    disabled = false,
    className = "",
    buttonClassName = "",
    menuClassName = "",
}: DropdownProps) {
    const [isOpen, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
    const closeDropdown = () => setOpen(false);

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value],
    );

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                !rootRef.current?.contains(target) &&
                !menuRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            window.removeEventListener("keydown", handleEscape);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const updateMenuPosition = () => {
            const root = rootRef.current;
            if (!root) {
                return;
            }

            const rect = root.getBoundingClientRect();
            const viewportPadding = 8;
            const menuGap = 4;

            const availableBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
            const availableAbove = rect.top - viewportPadding - menuGap;
            const shouldOpenUpward = availableBelow < 180 && availableAbove > availableBelow;
            const availableHeight = Math.max(0, shouldOpenUpward ? availableAbove : availableBelow);

            const nextStyle: CSSProperties = {
                position: "fixed",
                right: Math.max(viewportPadding, window.innerWidth - rect.right),
                minWidth: rect.width,
                maxWidth: Math.min(384, rect.right - viewportPadding),
                maxHeight: availableHeight,
                zIndex: 1000,
            };

            if (shouldOpenUpward) {
                nextStyle.bottom = window.innerHeight - rect.top + menuGap;
            } else {
                nextStyle.top = rect.bottom + menuGap;
            }

            setMenuStyle(nextStyle);
        };

        const schedulePositionUpdate = () => {
            requestAnimationFrame(updateMenuPosition);
        };

        updateMenuPosition();
        window.addEventListener("resize", schedulePositionUpdate);
        window.addEventListener("scroll", schedulePositionUpdate, true);

        return () => {
            window.removeEventListener("resize", schedulePositionUpdate);
            window.removeEventListener("scroll", schedulePositionUpdate, true);
        };
    }, [isOpen, options.length]);

    const handleSelect = (nextValue: string, optionDisabled?: boolean) => {
        if (disabled || optionDisabled) {
            return;
        }

        onChange(nextValue);
        closeDropdown();
    };

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <Button
                variant="secondary"
                size="sm"
                icon={selectedOption?.icon}
                iconSize={16}
                iconColor={selectedOption ? "var(--color-primary)" : ""}
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={cn("pr-3", buttonClassName)}
            >
                <span className={cn("flex-1 truncate", selectedOption ? "text-white" : "text-white/50")}>
                    {selectedOption?.label ?? placeholder}
                </span>
                <Icon
                    name="chevronDown"
                    size={16}
                    className={cn(
                        "shrink-0 transition-transform duration-150",
                        isOpen && "rotate-180 text-white",
                    )}
                />
            </Button>

            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    style={menuStyle}
                    className={cn(
                        "z-1000 flex w-max min-w-full max-w-96 flex-col items-start gap-0 overflow-y-auto rounded-2xl corner-squircle border border-white/20 p-0 divide-y bg-dark",
                        "shadow-[0_0_8px_rgb(0,0,0,0.2),inset_0_0_16px_rgb(255,255,255,0.05)]",
                        menuClassName,
                    )}
                >
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        const isOptionDisabled = option.disabled || disabled;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                disabled={isOptionDisabled}
                                onClick={() => handleSelect(option.value, option.disabled)}
                                className={cn(
                                    baseOptionStyles,
                                    isOptionDisabled
                                        ? buttonDisabledStyles
                                        : isSelected
                                            ? cn(buttonVariantStyles, buttonActiveStyles, "text-white")
                                            : buttonVariantStyles,
                                )}
                            >
                                {option.icon && (
                                    <Icon
                                        name={option.icon}
                                        size={16}
                                        className={cn(
                                            "shrink-0 transition-transform duration-150",
                                            isOpen && "rotate-180 text-white",
                                            isSelected && "text-primary",
                                        )}
                                    />
                                )}
                                <span className="whitespace-nowrap">{option.label}</span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
}
