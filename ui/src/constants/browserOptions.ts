import type { DropdownOption } from "@/components/Dropdown";
import type { LocaleMessages } from "@/locale";

export const BROWSER_OPTIONS = [
    { value: "default", icon: "settings" },
    { value: "brave", icon: "brave" },
    { value: "chrome", icon: "chrome" },
    { value: "chromium", icon: "chromium" },
    { value: "edge", icon: "edge" },
    { value: "firefox", icon: "firefox" },
    { value: "opera", icon: "opera" },
    { value: "safari", icon: "safari" },
    { value: "vivaldi", icon: "vivaldi" },
    { value: "whale", icon: "whale" },
] as const;

export type BrowserOptionValue = (typeof BROWSER_OPTIONS)[number]["value"];
export type BrowserDropdownOption = Omit<DropdownOption, "value"> & { value: BrowserOptionValue };

const BROWSER_OPTION_SET = new Set<string>(BROWSER_OPTIONS.map((option) => option.value));

export function isBrowserOptionValue(value: string): value is BrowserOptionValue {
    return BROWSER_OPTION_SET.has(value);
}

export function createBrowserOptions(locale: LocaleMessages): BrowserDropdownOption[] {
    return BROWSER_OPTIONS.map((option) => ({
        ...option,
        label: locale.browsers[option.value],
    }));
}
