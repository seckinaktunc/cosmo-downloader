import Row from "../ui/Row";

export interface RadioOption<T extends string = string> {
    value: T;
    label: string;
    helper: string;
}

interface RadioSelectorProps<T extends string = string> {
    title: string;
    hint?: string;
    name: string;
    options: readonly RadioOption<T>[];
    value: T;
    actionButtonLabel?: string;
    actionButtonIcon?: string;
    actionButtonOnClick?: () => void;
    onChange: (value: T) => void;
}

export default function RadioSelector<T extends string = string>({
    title,
    hint,
    name,
    options,
    value,
    actionButtonLabel,
    actionButtonIcon,
    actionButtonOnClick,
    onChange,
}: RadioSelectorProps<T>) {
    return (
        <Row orientation="vertical" title={title} hint={hint} actionButtonLabel={actionButtonLabel} actionButtonIcon={actionButtonIcon} actionButtonOnClick={actionButtonOnClick}>
            <div className="flex w-full gap-1">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className={`group relative flex flex-1 cursor-pointer flex-col rounded-md corner-squircle border p-3 transition ${value === option.value
                            ? "border-primary bg-primary/15 shadow-[inset_0_0_20px_var(--color-primary)] shadow-primary/50"
                            : "border-white/10 bg-black/30 hover:border-white/20"
                            }`}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={(e) => onChange(e.target.value as T)}
                            className="sr-only"
                        />
                        <span className="text-sm font-semibold text-white">{option.label}</span>
                        <span className="text-[11px] text-white/60">
                            {option.helper}
                        </span>
                    </label>
                ))}
            </div>
        </Row>
    );
}
