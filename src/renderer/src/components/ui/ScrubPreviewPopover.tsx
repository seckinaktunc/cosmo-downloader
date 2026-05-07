import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeFloatingPosition, type FloatingPosition } from '../../lib/floatingPosition';
import { getScrubPreviewSpriteLayout } from '../../lib/scrubPreviewLayout';
import { Tooltip } from './Tooltip';

type ScrubPreviewPopoverProps = {
  open: boolean;
  anchorPoint: { x: number; y: number } | null;
  imageUrl: string | null;
  frameWidth: number;
  frameHeight: number;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  tileColumn: number;
  tileRow: number;
  timecode: string;
  offset?: number;
};

export function ScrubPreviewPopover({
  open,
  anchorPoint,
  imageUrl,
  frameWidth,
  frameHeight,
  tileWidth,
  tileHeight,
  columns,
  rows,
  tileColumn,
  tileRow,
  timecode,
  offset = 12
}: ScrubPreviewPopoverProps): React.JSX.Element | null {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const updatePosition = useCallback((): void => {
    const preview = previewRef.current;
    if (!preview || anchorPoint == null) {
      return;
    }

    const rect = preview.getBoundingClientRect();
    const nextPosition = computeFloatingPosition({
      anchor: { type: 'point', point: anchorPoint },
      size: { width: rect.width, height: rect.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      placement: 'top',
      offset
    });

    setPosition((current) => {
      if (
        current &&
        current.left === nextPosition.left &&
        current.top === nextPosition.top &&
        current.placement === nextPosition.placement &&
        current.tailSide === nextPosition.tailSide &&
        current.tailOffset === nextPosition.tailOffset
      ) {
        return current;
      }

      return nextPosition;
    });
  }, [anchorPoint, offset]);

  useLayoutEffect(() => {
    if (open && anchorPoint != null && imageUrl != null) {
      updatePosition();
    }
  }, [anchorPoint, frameHeight, frameWidth, imageUrl, open, updatePosition]);

  useEffect(() => {
    if (!open || anchorPoint == null || imageUrl == null) {
      return undefined;
    }

    const handleUpdate = (): void => updatePosition();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleUpdate);
    if (previewRef.current && observer) {
      observer.observe(previewRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      observer?.disconnect();
    };
  }, [anchorPoint, imageUrl, open, updatePosition]);

  if (!open || anchorPoint == null || imageUrl == null) {
    return null;
  }

  const spriteLayout = getScrubPreviewSpriteLayout({
    frameWidth,
    frameHeight,
    tileWidth,
    tileHeight,
    columns,
    rows,
    tileColumn,
    tileRow
  });
  const spriteImageUrl = `url(${JSON.stringify(imageUrl)})`;

  return createPortal(
    <div
      aria-label="Scrub preview"
      className="pointer-events-none fixed z-50 inline-block"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? 'visible' : 'hidden'
      }}
      data-placement={position?.placement}
    >
      <div
        ref={previewRef}
        className="relative overflow-visible aspect-video"
        style={{
          width: `${frameWidth}px`,
          height: `${frameHeight}px`
        }}
      >
        <div
          aria-hidden="true"
          className="relative overflow-hidden rounded-md border border-white bg-black shadow-lg shadow-black/35 aspect-video"
          style={{
            width: `${frameWidth}px`,
            height: `${frameHeight}px`
          }}
        >
          <div
            className="absolute overflow-hidden"
            style={{
              left: `${spriteLayout.insetX}px`,
              top: `${spriteLayout.insetY}px`,
              width: `${spriteLayout.renderedTileWidth}px`,
              height: `${spriteLayout.renderedTileHeight}px`
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: spriteImageUrl,
                backgroundPosition: `${spriteLayout.spriteOffsetX}px ${spriteLayout.spriteOffsetY}px`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${spriteLayout.spriteWidth}px ${spriteLayout.spriteHeight}px`
              }}
            />
          </div>
        </div>
        {position && (
          <Tooltip
            open
            label={timecode}
            placement="top"
            className="pointer-events-none absolute z-10"
            style={{
              left: `${position.tailOffset}px`,
              top: 'calc(100% + 3.5rem)',
              transform: 'translateX(-50%)'
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
