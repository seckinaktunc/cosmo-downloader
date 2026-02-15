import type { ReactNode } from "react";

interface RowProps {
    children: ReactNode;
    orientation?: "horizontal" | "vertical";
    className?: string;
}

export default function Row({ children, orientation = "horizontal", className }: RowProps) {
    return (
        <div
            className={`
                flex ${orientation === "horizontal" ? "flex-row" : "flex-col"}
                w-full gap-2 justify-between items-center shadow-[0_0_4px_rgb(0,0,0,0.2),inset_0_0_16px_rgb(255,255,255,0.05)]
                rounded-2xl corner-squircle border border-white/10 bg-white/5 p-2 ${className}
            `}
        >
            {children}
        </div>
    )
}
