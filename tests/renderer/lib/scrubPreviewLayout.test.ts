import { describe, expect, it } from 'vitest';
import {
  getScrubPreviewFrameSize,
  getScrubPreviewSpriteLayout,
  getScrubPreviewTileRenderMetrics
} from '@renderer/lib/scrubPreviewLayout';

describe('scrubPreviewLayout', () => {
  it('keeps the existing width clamp and derives a 16:9 frame height', () => {
    expect(getScrubPreviewFrameSize(80)).toEqual({ width: 120, height: 68 });
    expect(getScrubPreviewFrameSize(160)).toEqual({ width: 160, height: 90 });
    expect(getScrubPreviewFrameSize(320)).toEqual({ width: 200, height: 113 });
  });

  it('contains portrait, square, and wide tiles inside the 16:9 frame without stretching', () => {
    expect(
      getScrubPreviewTileRenderMetrics({
        frameWidth: 160,
        frameHeight: 90,
        tileWidth: 100,
        tileHeight: 200
      })
    ).toEqual({
      renderedTileWidth: 45,
      renderedTileHeight: 90,
      insetX: 57.5,
      insetY: 0
    });

    expect(
      getScrubPreviewTileRenderMetrics({
        frameWidth: 160,
        frameHeight: 90,
        tileWidth: 100,
        tileHeight: 100
      })
    ).toEqual({
      renderedTileWidth: 90,
      renderedTileHeight: 90,
      insetX: 35,
      insetY: 0
    });

    expect(
      getScrubPreviewTileRenderMetrics({
        frameWidth: 160,
        frameHeight: 90,
        tileWidth: 200,
        tileHeight: 100
      })
    ).toEqual({
      renderedTileWidth: 160,
      renderedTileHeight: 80,
      insetX: 0,
      insetY: 5
    });
  });

  it('keeps sprite offsets tied to the original tile grid inside a single-tile viewport', () => {
    expect(
      getScrubPreviewSpriteLayout({
        frameWidth: 160,
        frameHeight: 90,
        tileWidth: 100,
        tileHeight: 200,
        columns: 5,
        rows: 4,
        tileColumn: 2,
        tileRow: 1
      })
    ).toEqual({
      renderedTileWidth: 45,
      renderedTileHeight: 90,
      insetX: 57.5,
      insetY: 0,
      spriteWidth: 225,
      spriteHeight: 360,
      spriteOffsetX: -90,
      spriteOffsetY: -90
    });
  });

  it('keeps portrait tiles isolated so adjacent sprite columns cannot leak into the frame', () => {
    const layout = getScrubPreviewSpriteLayout({
      frameWidth: 160,
      frameHeight: 90,
      tileWidth: 100,
      tileHeight: 200,
      columns: 5,
      rows: 4,
      tileColumn: 2,
      tileRow: 1
    });

    expect(layout.renderedTileWidth).toBe(45);
    expect(layout.insetX).toBe(57.5);
    expect(layout.spriteOffsetX).toBe(-2 * layout.renderedTileWidth);
    expect(layout.spriteWidth).toBe(5 * layout.renderedTileWidth);
  });
});
