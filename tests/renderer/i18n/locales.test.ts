import { describe, expect, it } from 'vitest';
import { icons as flags } from '@iconify-json/flag';
import { SUPPORTED_LOCALES } from '@renderer/i18n';
import type { IconName } from '@renderer/components/miscellaneous/Icon';
import enUS from '@renderer/i18n/en_US.json';
import trTR from '@renderer/i18n/tr_TR.json';
import zhCN from '@renderer/i18n/zh_CN.json';

const localeIconNames = SUPPORTED_LOCALES.map((locale) => locale.icon) satisfies IconName[];

type LocaleNode = string | { [key: string]: LocaleNode };

function flattenKeys(value: LocaleNode, prefix = ''): string[] {
  if (typeof value === 'string') {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

function flattenStrings(value: LocaleNode, prefix = ''): Map<string, string> {
  if (typeof value === 'string') {
    return new Map([[prefix, value]]);
  }

  return new Map(
    Object.entries(value).flatMap(([key, child]) =>
      Array.from(flattenStrings(child, prefix ? `${prefix}.${key}` : key))
    )
  );
}

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/{{\s*[\w.]+\s*}}/g), ([match]) => match).sort();
}

describe('i18n locale resources', () => {
  it('keeps Turkish and Simplified Chinese keys aligned with English', () => {
    const englishKeys = flattenKeys(enUS).sort();

    expect(flattenKeys(trTR).sort()).toEqual(englishKeys);
    expect(flattenKeys(zhCN).sort()).toEqual(englishKeys);
  });

  it('preserves interpolation placeholders across locales', () => {
    const englishStrings = flattenStrings(enUS);

    for (const locale of [trTR, zhCN]) {
      const localeStrings = flattenStrings(locale);
      for (const [key, englishValue] of englishStrings) {
        expect(placeholders(localeStrings.get(key) ?? '')).toEqual(placeholders(englishValue));
      }
    }
  });

  it('uses installed rectangular flag icons for supported locales', () => {
    expect(localeIconNames).toEqual(['flag:us-4x3', 'flag:tr-4x3', 'flag:cn-4x3']);

    for (const iconName of localeIconNames) {
      const iconId = iconName.replace('flag:', '');
      expect(flags.icons[iconId]).toBeDefined();
    }
  });
});
