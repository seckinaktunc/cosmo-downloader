import type { ReactNode } from "react";
import Icon from "../Icon";

interface RowProps {
    children: ReactNode;
    orientation?: "horizontal" | "vertical";
    title?: string;
    hint?: string;
    actionButtonLabel?: string;
    actionButtonIcon?: string;
    actionButtonOnClick?: () => void;
    className?: string;
}

export default function Row({ children, orientation = "horizontal", title, hint, actionButtonLabel, actionButtonIcon, actionButtonOnClick, className }: RowProps) {
    return (
        <div
            className={`
                flex flex-col w-full gap-2 justify-between items-center shadow-[0_0_4px_rgb(0,0,0,0.2),inset_0_0_16px_rgb(255,255,255,0.05)]
                rounded-2xl corner-squircle border border-white/10 bg-white/5 p-2 ${className}
            `}
        >
            {(title || hint) &&
                <div className="grid grid-cols-2 w-full justify-between">
                    <span className="text-xs w-full font-bold uppercase tracking-widest text-white/50 text-left">
                        {title}
                    </span>
                    <div className="flex justify-end gap-2">
                        {actionButtonLabel &&
                            <button
                                className="flex gap-1 items-center text-xs text-primary"
                                onClick={actionButtonOnClick}
                            >
                                {actionButtonIcon &&
                                    <Icon name={actionButtonIcon} size={12} />
                                }
                                {actionButtonLabel}
                            </button>
                        }
                        {hint &&
                            <span className="text-xs text-white/50 text-nowrap text-right">
                                {hint}
                            </span>
                        }
                    </div>
                </div>
            }
            <div
                className={`flex w-full justify-between items-center ${orientation === "horizontal" ? "flex-row" : "flex-col"}`}
            >
                {children}
            </div>
        </div>
    )
}
