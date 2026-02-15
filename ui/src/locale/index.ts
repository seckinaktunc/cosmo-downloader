import { useSettingsStore, type LocaleCode } from "@/stores/settingsStore";
import enUS from "./en_US.json";
import trTR from "./tr_TR.json";
import zhCN from "./zh_CN.json";

const LOCALES = {
  tr_TR: trTR,
  en_US: enUS,
  zh_CN: zhCN,
} as const;

export type LocaleMessages = (typeof LOCALES)["tr_TR"];

export function getLocaleMessages(language: LocaleCode | undefined): LocaleMessages {
  if (!language) {
    return LOCALES.tr_TR;
  }

  return LOCALES[language] ?? LOCALES.tr_TR;
}

export function useLocale() {
  const language = useSettingsStore((state) => state.language);
  const locale = getLocaleMessages(language);

  return { language, locale };
}
