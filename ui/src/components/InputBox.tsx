import { forwardRef, type ComponentProps, type CSSProperties } from "react";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";
import Button from "./Button";

interface InputBoxProps extends ComponentProps<"input"> {
    containerStyle?: CSSProperties;
    containerClassName?: string;
    label?: string;
    stopPropagation?: boolean;
    onPaste?: () => void;
    onClear?: () => void;
}

const InputBox = forwardRef<HTMLInputElement, InputBoxProps>(({
    className,
    containerStyle,
    containerClassName,
    type = "text",
    stopPropagation = false,
    onPaste,
    onClear,
    ...rest
}, ref) => {
    const baseStyles = "flex-1 w-full h-12 px-3 py-2 bg-white/5 border border-white/10 rounded-2xl corner-squircle text-white placeholder:text-white/20 text-sm placeholder:text-sm focus:placeholder:text-white/35 focus:outline-none focus:bg-white/10 hover:border-primary/35 focus:border-primary transition-all disabled:opacity-50";

    return (
        <div
            className={twMerge(clsx(containerClassName, "relative"))}
            style={containerStyle}
        >
            {rest.value ?
                <Button
                    variant="secondary"
                    isIcon
                    icon="close"
                    className="absolute right-0 opacity-50"
                    stopPropagation={stopPropagation}
                    onClick={onClear}
                    ghost
                />
                : onPaste &&
                <Button
                    variant="secondary"
                    isIcon
                    icon="paste"
                    className="absolute right-0 opacity-50"
                    stopPropagation={stopPropagation}
                    onClick={onPaste}
                    ghost
                />
            }
            <input
                ref={ref}
                type={type}
                className={twMerge(clsx(baseStyles, className, "pr-12"))}
                onMouseDown={(e) => {
                    if (stopPropagation) e.stopPropagation();
                    rest.onMouseDown?.(e);
                }}
                {...rest}
            />
        </div>
    );
}
);

InputBox.displayName = "InputBox";

export default InputBox;