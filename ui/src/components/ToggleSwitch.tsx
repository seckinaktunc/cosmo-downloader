interface ToggleSwitchProps {
    id?: string;
    value: boolean;
    onChange: (checked: boolean) => void;
}

export default function ToggleSwitch({ id = "toggle-switch", value, onChange }: ToggleSwitchProps) {
    return (
        <div className="relative h-8 w-14">
            <input
                type="checkbox"
                className="peer absolute h-0 w-0 opacity-0"
                id={id}
                checked={value}
                onChange={(event) => onChange(event.target.checked)}
            />
            <label
                className="
                    shadow-[inset_0_0_20px_var(--color-white)] shadow-white/35 border border-white/15
                    block h-full w-full cursor-pointer rounded-full bg-white/10 transition-all duration-300
                    
                    peer-checked:bg-primary/25 
                    peer-checked:border-primary/50 
                    peer-checked:shadow-primary 
                    
                    peer-checked:[&_span]:translate-x-6 
                    peer-checked:[&_span]:bg-white"
                htmlFor={id}
            >
                <span
                    className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white/50 transition-all duration-300"
                />
            </label>
        </div>
    );
}