import { FORMAT_OPTIONS } from "../../constants/options";
import { useDownloadStore, type FormatOption } from "../../stores/downloadStore";
import Row from "../Row";

export default function Formats() {
    const format = useDownloadStore((state) => state.format);
    const setFormat = useDownloadStore((state) => state.setFormat);

    return (
        <Row orientation="vertical">
            <div className="flex w-full justify-between items-end">
                <div className="text-xs font-bold uppercase tracking-widest text-white/50">
                    FORMAT
                </div>
                <span className="text-xs text-white/50">
                    {FORMAT_OPTIONS.find((option) => option.value === format)?.label}
                </span>
            </div>
            <div className="flex w-full gap-1">
                {FORMAT_OPTIONS.map((option) => (
                    <label
                        key={option.value}
                        className={`group relative flex flex-1 cursor-pointer flex-col rounded-md border p-3 transition ${format === option.value
                            ? "border-primary bg-primary/15 shadow-[inset_0_0_20px_var(--color-primary)] shadow-primary/50"
                            : "border-white/10 bg-black/30 hover:border-white/20"
                            }`}
                    >
                        <input
                            type="radio"
                            name="format"
                            value={option.value}
                            checked={format === option.value}
                            onChange={(e) => setFormat(e.target.value as FormatOption)}
                            className="sr-only"
                        />
                        <span className="text-sm font-semibold text-white">{option.label}</span>
                        {option.helper && <span className="text-[11px] text-white/60">{option.helper}</span>}
                    </label>
                ))}
            </div>
        </Row>
    );
}
