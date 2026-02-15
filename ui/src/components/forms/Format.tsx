import { FORMAT_OPTIONS } from "../../constants/options";
import { useDownloadStore, type FormatOption } from "../../stores/downloadStore";
import { useLocale } from "../../locale";
import Row from "../ui/Row";

export default function Formats() {
    const format = useDownloadStore((state) => state.format);
    const setFormat = useDownloadStore((state) => state.setFormat);
    const { locale } = useLocale();

    return (
        <Row orientation="vertical">
            <div className="flex w-full justify-between items-end">
                <div className="text-xs font-bold uppercase tracking-widest text-white/50">
                    {locale.common.format}
                </div>
                <span className="text-xs text-white/50">
                    {format.toUpperCase()}
                </span>
            </div>
            <div className="flex w-full gap-1">
                {FORMAT_OPTIONS.map((option) => (
                    <label
                        key={option}
                        className={`group relative flex flex-1 cursor-pointer flex-col rounded-md border p-3 transition ${format === option
                            ? "border-primary bg-primary/15 shadow-[inset_0_0_20px_var(--color-primary)] shadow-primary/50"
                            : "border-white/10 bg-black/30 hover:border-white/20"
                            }`}
                    >
                        <input
                            type="radio"
                            name="format"
                            value={option}
                            checked={format === option}
                            onChange={(e) => setFormat(e.target.value as FormatOption)}
                            className="sr-only"
                        />
                        <span className="text-sm font-semibold text-white">{option.toUpperCase()}</span>
                        <span className="text-[11px] text-white/60">
                            {locale.formats.helpers[option]}
                        </span>
                    </label>
                ))}
            </div>
        </Row>
    );
}
