import { type ButtonHTMLAttributes, type ReactNode } from "react";
import Icon from "./Icon";
import { cn } from "../utils/cn";

type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "tertiary";
    isIcon?: boolean;
    size?: ButtonSize;
    ghost?: boolean;
    children?: ReactNode;
    label?: string;
    icon?: string;
    iconSize?: number;
    iconColor?: string;
    iconClassName?: string;
    loading?: boolean;
    active?: boolean;
    stopPropagation?: boolean;
}

export default function Button({
    variant = "primary",
    isIcon = false,
    size = "md",
    ghost = false,
    children,
    label,
    icon,
    iconSize = 20,
    iconColor,
    iconClassName = "",
    className = "",
    disabled,
    loading = false,
    active = false,
    stopPropagation = false,
    ...rest
}: ButtonProps) {
    const baseStyles = "font-medium text-sm transition-all active:brightness-75 active:transition-none disabled:active:brightness-100 gap-2 flex items-center justify-center";
    const sizeMap = {
        xs: { icon: "w-4 h-4", primary: "h-4" },
        sm: { icon: "w-9 h-9", primary: "h-9" },
        md: { icon: "w-12 h-12", primary: "h-12" },
        lg: { icon: "w-16 h-16", primary: "h-16" },
    };
    const glowClass = (!ghost && !disabled)
        ? "shadow-[inset_0_0_20px_var(--color-primary)]"
        : "";

    const getLayoutClasses = () => {
        const dimensions = isIcon
            ? sizeMap[size].icon
            : `${sizeMap[size].primary} w-fit px-4`;

        const rounding = (isIcon && size === "xs")
            ? "rounded-full"
            : "rounded-2xl corner-squircle";

        return `${dimensions} ${rounding}`;
    };

    const getVariantClasses = () => {
        const layout = getLayoutClasses();

        if (variant === "primary") {
            if (disabled) return `${layout} border border-primary/10 bg-primary/5 text-white/20 cursor-not-allowed grayscale shadow-none`;
            if (active) return `${layout} border border-primary/25 bg-primary/5 text-white shadow-primary/25`;
            if (ghost) return `${layout} text-primary border border-transparent hover:bg-primary/10`;
            return `${layout} border border-primary/50 bg-primary/25 shadow-primary/50 hover:border-primary`;
        }

        if (variant === "secondary") {
            if (disabled) return `${layout} border border-white/10 bg-white/5 text-white/20 cursor-not-allowed grayscale shadow-none`;
            if (active) return `${layout} border border-white/25 bg-white/5 text-white shadow-white/25`;
            if (ghost) return `${layout} text-white/50 hover:text-white hover:brightness-125 border-0 border-transparent`;
            return `${layout} text-white/50 bg-white/5 border border-white/25 shadow-white/25 hover:bg-white/15 hover:border-white/35 hover:text-white`;
        }

        if (variant === "tertiary") {
            if (disabled) return `${layout} border border-primary/10 bg-primary/5 text-white/20 cursor-not-allowed`;
            if (active) return `${layout} border border-primary/25 bg-primary/5 text-white shadow-primary/25`;
            if (ghost) return `${layout} text-primary border border-transparent hover:bg-primary/10`;
            return `${layout} border-none bg-none shadow-none p-0 h-auto w-auto text-xs text-primary hover:underline gap-1`;
        }

        return "";
    };

    const resolvedIconColor = iconColor || (variant === "primary" && !disabled
        ? "var(--color-primary)"
        : undefined);

    return (
        <button
            className={cn(baseStyles, glowClass, getVariantClasses(), className)}
            disabled={disabled || loading}
            onMouseDown={(e) => {
                if (stopPropagation) e.stopPropagation();
                rest.onMouseDown?.(e);
            }}
            {...rest}
        >
            {loading ? (
                <Icon
                    name="spinner"
                    size={iconSize}
                    color={resolvedIconColor}
                    className="animate-spin"
                />
            ) : (
                <>
                    {icon && (
                        <Icon
                            name={icon}
                            size={iconSize}
                            color={resolvedIconColor}
                            className={iconClassName}
                        />
                    )}
                    {label || children}
                </>
            )}
        </button>
    );
}