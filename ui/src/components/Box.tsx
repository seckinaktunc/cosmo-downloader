import { motion } from "framer-motion";
import { type ReactNode, type MouseEvent } from "react";
import { cn } from "../utils/cn";

interface BoxProps {
    children: ReactNode;
    className?: string;
    onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
}

export default function Box({ children, className, onMouseDown }: BoxProps) {
    return (
        <motion.div
            onMouseDown={onMouseDown}
            className={cn(
                "relative w-full min-h-8 flex items-center p-2 gap-2",
                "bg-dark border border-white/15 rounded-3xl corner-squircle cursor-default overflow-hidden",
                "shadow-[0_0_8px_rgb(0,0,0,0.2),inset_0_0_16px_rgb(255,255,255,0.05)]",
                className
            )}
        >
            {children}
        </motion.div>
    );
}