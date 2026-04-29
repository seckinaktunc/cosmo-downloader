import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeFloatingPosition, type FloatingPosition } from '../../lib/floatingPosition';
import { Tooltip } from './Tooltip';

type ScrubPreviewPopoverProps = {
  open: boolean;
  anchorPoint: { x: number; y: number } | null;
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
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
  imageWidth,
  imageHeight,
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
  }, [anchorPoint, imageUrl, imageHeight, imageWidth, open, updatePosition]);

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
      <div ref={previewRef} className="relative overflow-visible">
        <div
          aria-hidden="true"
          className="overflow-hidden rounded-md border border-white bg-white shadow-lg shadow-black/35"
          style={{
            width: `${imageWidth}px`,
            height: `${imageHeight}px`,
            backgroundImage: `url(${JSON.stringify(imageUrl)})`,
            backgroundPosition: `-${tileColumn * imageWidth}px -${tileRow * imageHeight}px`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${imageWidth * columns}px ${imageHeight * rows}px`
          }}
        />
        {position ? (
          <Tooltip
            open
            label={timecode}
            placement="top"
            className="pointer-events-none absolute z-10"
            style={{
              left: `${position.tailOffset}px`,
              bottom: 'calc(-50% - 0.25rem)',
              transform: 'translateX(-50%)'
            }}
          />
        ) : null}
      </div>
    </div>,
    document.body
  );
}
