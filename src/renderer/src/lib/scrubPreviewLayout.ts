export type ScrubPreviewSize = {
  width: number;
  height: number;
};

export type ScrubPreviewTileRenderMetrics = {
  renderedTileWidth: number;
  renderedTileHeight: number;
  insetX: number;
  insetY: number;
};

export type ScrubPreviewSpriteLayout = ScrubPreviewTileRenderMetrics & {
  spriteWidth: number;
  spriteHeight: number;
  spriteOffsetX: number;
  spriteOffsetY: number;
};

export const SCRUB_PREVIEW_MIN_WIDTH_PX = 120;
export const SCRUB_PREVIEW_MAX_WIDTH_PX = 200;
const SCRUB_PREVIEW_FRAME_ASPECT_RATIO = 16 / 9;

export function getScrubPreviewFrameSize(tileWidth: number): ScrubPreviewSize {
  const width = Math.max(
    SCRUB_PREVIEW_MIN_WIDTH_PX,
    Math.min(SCRUB_PREVIEW_MAX_WIDTH_PX, Math.max(1, tileWidth))
  );

  return {
    width,
    height: Math.max(1, Math.round(width / SCRUB_PREVIEW_FRAME_ASPECT_RATIO))
  };
}

export function getScrubPreviewTileRenderMetrics({
  frameWidth,
  frameHeight,
  tileWidth,
  tileHeight
}: {
  frameWidth: number;
  frameHeight: number;
  tileWidth: number;
  tileHeight: number;
}): ScrubPreviewTileRenderMetrics {
  const safeFrameWidth = Math.max(1, frameWidth);
  const safeFrameHeight = Math.max(1, frameHeight);
  const safeTileWidth = Math.max(1, tileWidth);
  const safeTileHeight = Math.max(1, tileHeight);
  const widthScale = safeFrameWidth / safeTileWidth;
  const heightScale = safeFrameHeight / safeTileHeight;
  const scale = Math.min(widthScale, heightScale);
  const renderedTileWidth = safeTileWidth * scale;
  const renderedTileHeight = safeTileHeight * scale;

  return {
    renderedTileWidth,
    renderedTileHeight,
    insetX: (safeFrameWidth - renderedTileWidth) / 2,
    insetY: (safeFrameHeight - renderedTileHeight) / 2
  };
}

export function getScrubPreviewSpriteLayout({
  frameWidth,
  frameHeight,
  tileWidth,
  tileHeight,
  columns,
  rows,
  tileColumn,
  tileRow
}: {
  frameWidth: number;
  frameHeight: number;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  tileColumn: number;
  tileRow: number;
}): ScrubPreviewSpriteLayout {
  const metrics = getScrubPreviewTileRenderMetrics({
    frameWidth,
    frameHeight,
    tileWidth,
    tileHeight
  });
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);

  return {
    ...metrics,
    spriteWidth: metrics.renderedTileWidth * safeColumns,
    spriteHeight: metrics.renderedTileHeight * safeRows,
    spriteOffsetX: -tileColumn * metrics.renderedTileWidth,
    spriteOffsetY: -tileRow * metrics.renderedTileHeight
  };
}
