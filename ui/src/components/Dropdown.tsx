import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { cn } from "@/utils/cn";
import Button from "./Button";
import Box from "./ui/Box";

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
    menuClassName?: string;
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
    menuClassName = "",
}: DropdownProps) {
    const [isOpen, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const closeDropdown = () => setOpen(false);

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value],
    );

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
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
                className="pr-3"
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

            {isOpen && (
                <Box
                    className={cn(
                        "absolute right-0 z-40 mt-1 flex max-h-42 w-max min-w-full max-w-96 flex-col items-start gap-0 overflow-y-scroll rounded-2xl border-white/25 p-0 divide-y divide-white/5",
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
                </Box>
            )}
        </div>
    );
}
