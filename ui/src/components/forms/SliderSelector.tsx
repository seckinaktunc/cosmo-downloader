import React from "react";
import Row from "../Row";

export interface SliderOption {
    label: string;
    value: number | string;
}

interface SliderSelectorProps {
    title: string;
    options: readonly SliderOption[];
    value: number | string;
    onChange: (value: any) => void;
}

export default function SliderSelector({
    title,
    options,
    value,
    onChange,
}: SliderSelectorProps) {
    const currentIndex = options.findIndex((opt) => opt.value === value);
    const maxIndex = options.length - 1;
    const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const index = Number(e.target.value);
        onChange(options[index].value);
    };

    return (
        <Row orientation="vertical">
            <div className="flex w-full justify-between items-end">
                <div className="text-xs font-bold uppercase tracking-widest text-white/50">
                    {title}
                </div>
                <span className="text-xs text-white/50">
                    {options[safeCurrentIndex]?.label}
                </span>
            </div>

            <div className="relative flex flex-col w-full pt-2 pb-6">
                <input
                    type="range"
                    min={0}
                    max={maxIndex}
                    step={1}
                    value={safeCurrentIndex}
                    onChange={handleChange}
                    style={{
                        backgroundSize: `${(safeCurrentIndex / maxIndex) * 100}% 100%`,
                    }}
                    className={`
                            w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer z-10
                            bg-linear-to-r from-primary/50 to-primary bg-no-repeat
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-3.5 
                            [&::-webkit-slider-thumb]:h-3.5 
                            [&::-webkit-slider-thumb]:rounded-full 
                            [&::-webkit-slider-thumb]:bg-primary 
                            [&::-webkit-slider-thumb]:transition-all
                            hover:[&::-webkit-slider-thumb]:bg-white 
                            hover:[&::-webkit-slider-thumb]:scale-125
                        `}
                />

                <div className="absolute top-6 w-full h-4 pointer-events-none">
                    {options.map((option, index) => {
                        const percent = (index / maxIndex) * 100;

                        let translateClass = "-translate-x-1/2";
                        if (index === 0) translateClass = "-translate-x-0";
                        if (index === maxIndex) translateClass = "-translate-x-full";

                        return (
                            <span
                                key={option.value}
                                onClick={() => onChange(option.value)}
                                className={`
                                        absolute text-[10px] text-nowrap cursor-pointer pointer-events-auto
                                        ${option.value === value
                                        ? "text-white font-medium"
                                        : "text-white/20 hover:text-white/75"
                                    }
                                        transition-colors ${translateClass}
                                    `}
                                style={{ left: `${percent}%` }}
                            >
                                {option.label}
                            </span>
                        );
                    })}
                </div>
            </div>
        </Row>
    );
}