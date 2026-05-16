import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocationSelector } from '@renderer/components/ui/LocationSelector';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('LocationSelector', () => {
  it('keeps the placeholder display for disabled selectors by default', () => {
    const html = renderToStaticMarkup(
      <LocationSelector
        chooseLabel="actions.choose"
        path="/downloads/history/"
        value="final export"
        suffix=".mp4"
        onChoose={() => undefined}
        onOpen={() => undefined}
        disabled
      />
    );

    expect(html).toContain('exportSettings.noSavePath');
    expect(html).not.toContain('/downloads/history/');
    expect(html).not.toContain('value="final export"');
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('shows read-only path and filename while remaining disabled when requested', () => {
    const html = renderToStaticMarkup(
      <LocationSelector
        chooseLabel="actions.choose"
        path="/downloads/history/"
        value="final export"
        suffix=".mp4"
        displayWhenDisabled
        onChoose={() => undefined}
        onOpen={() => undefined}
        disabled
      />
    );

    expect(html).toContain('/downloads/history/');
    expect(html).toContain('value="final export"');
    expect(html).toContain('.mp4');
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
