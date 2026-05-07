import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatTimecode,
  normalizeTrimRange,
  parseTimecode,
  TRIM_MIN_LENGTH_SECONDS
} from '../../../../shared/trim';
import type { ScrubPreviewStoryboard } from '../../../../shared/types';
import { getScrubPreviewFrameSize } from '../../lib/scrubPreviewLayout';
import { cn } from '../../lib/utils';
import Icon from '../miscellaneous/Icon';
import { ScrubPreviewPopover } from './ScrubPreviewPopover';
import { Tooltip } from './Tooltip';

type RangeValue = {
  startSeconds: number;
  endSeconds: number;
};

type RangeSliderProps = {
  label: string;
  startLabel: string;
  endLabel: string;
  value: RangeValue;
  max: number;
  scrubPreview?: ScrubPreviewStoryboard;
  onChange: (value: RangeValue) => void;
  disabled?: boolean;
  invalidLabel?: string;
};

type DraftInput = {
  field: 'start' | 'end' | null;
  text: string;
};

type RangeDragState = {
  pointerId: number;
  initialClientX: number;
  initialStartSeconds: number;
  initialEndSeconds: number;
  trackWidth: number;
};

type PreviewThumb = 'start' | 'end';

type ResolvedScrubPreviewFrame = {
  fragmentKey: string;
  fragmentUrl: string;
  headers?: ScrubPreviewStoryboard['headers'];
  tileColumn: number;
  tileRow: number;
  timeSeconds: number;
};

type PreviewImageState =
  | { key: null; status: 'idle' }
  | { key: string; status: 'loading' | 'error' }
  | { key: string; status: 'ready'; dataUrl: string };

const THUMB_HOVER_RADIUS_PX = 10;
const RANGE_THUMB_DIAMETER_PX = 14;
const PREVIEW_POPOVER_OFFSET_PX = 64;

function createScrubPreviewFragmentKey(
  url: string,
  headers: ScrubPreviewStoryboard['headers'] | undefined
): string {
  const normalizedHeaders =
    headers == null
      ? {}
      : Object.fromEntries(
          Object.entries(headers)
            .filter(([, value]) => value.trim().length > 0)
            .sort(([left], [right]) => left.localeCompare(right))
        );

  return `${url}\u001f${JSON.stringify(normalizedHeaders)}`;
}

function resolveHoveredThumb(
  clientX: number,
  trackElement: HTMLDivElement | null,
  startPercent: number,
  endPercent: number
): PreviewThumb | null {
  if (trackElement == null) {
    return null;
  }

  const trackRect = trackElement.getBoundingClientRect();
  const usableTrackWidth = trackRect.width - RANGE_THUMB_DIAMETER_PX;
  if (trackRect.width <= 0 || usableTrackWidth < 0) {
    return null;
  }

  const startX =
    trackRect.left + RANGE_THUMB_DIAMETER_PX / 2 + usableTrackWidth * (startPercent / 100);
  const endX = trackRect.left + RANGE_THUMB_DIAMETER_PX / 2 + usableTrackWidth * (endPercent / 100);
  const startDistance = Math.abs(clientX - startX);
  const endDistance = Math.abs(clientX - endX);
  const nearestDistance = Math.min(startDistance, endDistance);

  if (nearestDistance > THUMB_HOVER_RADIUS_PX) {
    return null;
  }

  return startDistance <= endDistance ? 'start' : 'end';
}

function resolveScrubPreviewFrame(
  scrubPreview: ScrubPreviewStoryboard,
  timeSeconds: number
): ResolvedScrubPreviewFrame | null {
  if (scrubPreview.fragments.length === 0) {
    return null;
  }

  const maxTime = Math.max(0, scrubPreview.totalDurationSeconds - scrubPreview.frameStepSeconds);
  let remainingTime = Math.max(0, Math.min(timeSeconds, maxTime));

  for (let index = 0; index < scrubPreview.fragments.length; index += 1) {
    const fragment = scrubPreview.fragments[index];
    const isLastFragment = index === scrubPreview.fragments.length - 1;

    if (remainingTime < fragment.durationSeconds || isLastFragment) {
      const tileIndex = Math.min(
        fragment.frameCount - 1,
        Math.max(0, Math.floor(remainingTime * scrubPreview.frameRate))
      );

      return {
        fragmentKey: createScrubPreviewFragmentKey(fragment.url, scrubPreview.headers),
        fragmentUrl: fragment.url,
        headers: scrubPreview.headers,
        tileColumn: tileIndex % scrubPreview.columns,
        tileRow: Math.floor(tileIndex / scrubPreview.columns),
        timeSeconds: Math.max(0, timeSeconds)
      };
    }

    remainingTime -= fragment.durationSeconds;
  }

  return null;
}

function getThumbCenterPoint(
  trackElement: HTMLDivElement | null,
  thumbPercent: number
): { x: number; y: number } | null {
  if (trackElement == null) {
    return null;
  }

  const trackRect = trackElement.getBoundingClientRect();
  if (trackRect.width <= 0) {
    return null;
  }

  const usableTrackWidth = Math.max(0, trackRect.width - RANGE_THUMB_DIAMETER_PX);
  const x =
    trackRect.left +
    RANGE_THUMB_DIAMETER_PX / 2 +
    (usableTrackWidth * Math.max(0, Math.min(thumbPercent, 100))) / 100;

  return {
    x,
    y: trackRect.top + trackRect.height / 2
  };
}

export function RangeSlider({
  label,
  startLabel,
  endLabel,
  value,
  max,
  scrubPreview,
  onChange,
  disabled = false,
  invalidLabel
}: RangeSliderProps): React.JSX.Element {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rangeDragRef = useRef<RangeDragState | null>(null);
  const previewImageCacheRef = useRef<Map<string, string>>(new Map());
  const [draft, setDraft] = useState<DraftInput>({ field: null, text: '' });
  const [error, setError] = useState<string | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);
  const [hoveredThumb, setHoveredThumb] = useState<PreviewThumb | null>(null);
  const [draggingThumb, setDraggingThumb] = useState<PreviewThumb | null>(null);
  const [previewAnchorPoint, setPreviewAnchorPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [previewImage, setPreviewImage] = useState<PreviewImageState>({
    key: null,
    status: 'idle'
  });
  const duration = Math.max(0, Math.floor(max));
  const normalized = useMemo(
    () => normalizeTrimRange(value.startSeconds, value.endSeconds, duration),
    [duration, value.endSeconds, value.startSeconds]
  );
  const range = Math.max(1, duration);
  const startPercent = (normalized.startSeconds / range) * 100;
  const endPercent = (normalized.endSeconds / range) * 100;
  const startText = draft.field === 'start' ? draft.text : formatTimecode(normalized.startSeconds);
  const endText = draft.field === 'end' ? draft.text : formatTimecode(normalized.endSeconds);
  const canDragSelectedRange =
    !disabled &&
    duration > TRIM_MIN_LENGTH_SECONDS &&
    normalized.endSeconds > normalized.startSeconds;
  const canPreviewThumbs = scrubPreview != null && duration > 0;
  const activePreviewThumb = isDraggingRange ? null : (draggingThumb ?? hoveredThumb);
  const activePreviewTime =
    activePreviewThumb === 'start'
      ? normalized.startSeconds
      : activePreviewThumb === 'end'
        ? normalized.endSeconds
        : null;
  const activePreviewFrame = useMemo(() => {
    if (!canPreviewThumbs || scrubPreview == null || activePreviewTime == null) {
      return null;
    }

    return resolveScrubPreviewFrame(scrubPreview, activePreviewTime);
  }, [activePreviewTime, canPreviewThumbs, scrubPreview]);
  const previewFrameSize = useMemo(
    () => (scrubPreview == null ? null : getScrubPreviewFrameSize(scrubPreview.tileWidth)),
    [scrubPreview]
  );
  const previewDataUrl =
    activePreviewFrame != null &&
    previewImage.status === 'ready' &&
    previewImage.key === activePreviewFrame.fragmentKey
      ? previewImage.dataUrl
      : null;
  const activePreviewTimecode =
    activePreviewFrame == null ? null : formatTimecode(activePreviewFrame.timeSeconds);
  const activePreviewFragmentKey = activePreviewFrame?.fragmentKey ?? null;
  const activePreviewFragmentUrl = activePreviewFrame?.fragmentUrl;
  const activePreviewHeaders = activePreviewFrame?.headers;
  const updatePreviewAnchorPoint = useCallback((): void => {
    if (activePreviewThumb == null) {
      setPreviewAnchorPoint(null);
      return;
    }

    setPreviewAnchorPoint(
      getThumbCenterPoint(
        trackRef.current,
        activePreviewThumb === 'start' ? startPercent : endPercent
      )
    );
  }, [activePreviewThumb, endPercent, startPercent]);

  const commitRange = (startSeconds: number, endSeconds: number): void => {
    if (disabled || duration <= 0) {
      return;
    }

    setError(null);
    onChange(normalizeTrimRange(startSeconds, endSeconds, duration));
  };

  const commitStartText = (): void => {
    if (disabled || duration <= 0) {
      return;
    }

    const parsed = parseTimecode(startText);
    if (parsed == null) {
      setError(invalidLabel ?? null);
      setDraft({ field: null, text: '' });
      return;
    }

    const nextRange = normalizeTrimRange(
      Math.min(parsed, normalized.endSeconds - TRIM_MIN_LENGTH_SECONDS),
      normalized.endSeconds,
      duration
    );
    setError(parsed === nextRange.startSeconds ? null : (invalidLabel ?? null));
    onChange(nextRange);
    setDraft({ field: null, text: '' });
  };

  const commitEndText = (): void => {
    if (disabled || duration <= 0) {
      return;
    }

    const parsed = parseTimecode(endText);
    if (parsed == null) {
      setError(invalidLabel ?? null);
      setDraft({ field: null, text: '' });
      return;
    }

    const nextRange = normalizeTrimRange(
      normalized.startSeconds,
      Math.max(parsed, normalized.startSeconds + TRIM_MIN_LENGTH_SECONDS),
      duration
    );
    setError(parsed === nextRange.endSeconds ? null : (invalidLabel ?? null));
    onChange(nextRange);
    setDraft({ field: null, text: '' });
  };

  const clearRangeDrag = (): void => {
    rangeDragRef.current = null;
    setIsDraggingRange(false);
  };

  useEffect(() => {
    if (!canPreviewThumbs) {
      setHoveredThumb(null);
      setDraggingThumb(null);
      setPreviewAnchorPoint(null);
      setPreviewImage({ key: null, status: 'idle' });
    }
  }, [canPreviewThumbs]);

  useLayoutEffect(() => {
    updatePreviewAnchorPoint();
  }, [updatePreviewAnchorPoint]);

  useEffect(() => {
    if (activePreviewThumb == null) {
      return undefined;
    }

    const handleUpdate = (): void => updatePreviewAnchorPoint();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleUpdate);
    if (trackRef.current && observer) {
      observer.observe(trackRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      observer?.disconnect();
    };
  }, [activePreviewThumb, updatePreviewAnchorPoint]);

  useEffect(() => {
    if (activePreviewFragmentKey == null || activePreviewFragmentUrl == null) {
      setPreviewImage({ key: null, status: 'idle' });
      return;
    }

    const cachedDataUrl = previewImageCacheRef.current.get(activePreviewFragmentKey);
    if (cachedDataUrl) {
      setPreviewImage({
        key: activePreviewFragmentKey,
        status: 'ready',
        dataUrl: cachedDataUrl
      });
      return;
    }

    let cancelled = false;
    setPreviewImage((current) =>
      current.key === activePreviewFragmentKey && current.status === 'loading'
        ? current
        : { key: activePreviewFragmentKey, status: 'loading' }
    );

    void window.cosmo.video
      .fetchScrubPreviewFragment({
        url: activePreviewFragmentUrl,
        headers: activePreviewHeaders
      })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setPreviewImage((current) =>
            current.key === activePreviewFragmentKey
              ? { key: activePreviewFragmentKey, status: 'error' }
              : current
          );
          return;
        }

        const image = new Image();
        image.onload = () => {
          if (cancelled) {
            return;
          }

          previewImageCacheRef.current.set(activePreviewFragmentKey, result.data.dataUrl);
          setPreviewImage({
            key: activePreviewFragmentKey,
            status: 'ready',
            dataUrl: result.data.dataUrl
          });
        };
        image.onerror = () => {
          if (cancelled) {
            return;
          }

          setPreviewImage({ key: activePreviewFragmentKey, status: 'error' });
        };
        image.src = result.data.dataUrl;
      });

    return () => {
      cancelled = true;
    };
  }, [activePreviewFragmentKey, activePreviewFragmentUrl, activePreviewHeaders]);

  const handleTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!canPreviewThumbs || draggingThumb != null || isDraggingRange) {
      return;
    }

    setHoveredThumb(resolveHoveredThumb(event.clientX, trackRef.current, startPercent, endPercent));
  };

  const handleTrackPointerLeave = (): void => {
    if (draggingThumb == null) {
      setHoveredThumb(null);
    }
  };

  const handleThumbPointerDown = (thumb: PreviewThumb) => (): void => {
    if (!canPreviewThumbs || disabled || duration <= TRIM_MIN_LENGTH_SECONDS) {
      return;
    }

    setDraggingThumb(thumb);
    setHoveredThumb(thumb);
  };

  const handleThumbPointerUp = (event: ReactPointerEvent<HTMLInputElement>): void => {
    setDraggingThumb(null);

    if (!canPreviewThumbs || isDraggingRange) {
      return;
    }

    setHoveredThumb(resolveHoveredThumb(event.clientX, trackRef.current, startPercent, endPercent));
  };

  const handleSelectedRangePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!canDragSelectedRange) {
      return;
    }

    const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 0;
    if (trackWidth <= 0) {
      return;
    }

    rangeDragRef.current = {
      pointerId: event.pointerId,
      initialClientX: event.clientX,
      initialStartSeconds: normalized.startSeconds,
      initialEndSeconds: normalized.endSeconds,
      trackWidth
    };
    setIsDraggingRange(true);
    setDraggingThumb(null);
    setHoveredThumb(null);
    setError(null);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSelectedRangePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const dragState = rangeDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const selectedLength = dragState.initialEndSeconds - dragState.initialStartSeconds;
    const deltaSeconds = Math.round(
      ((event.clientX - dragState.initialClientX) / dragState.trackWidth) * duration
    );
    const maxStart = Math.max(0, duration - selectedLength);
    const nextStart = Math.max(0, Math.min(maxStart, dragState.initialStartSeconds + deltaSeconds));

    commitRange(nextStart, nextStart + selectedLength);
  };

  const handleSelectedRangePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (rangeDragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearRangeDrag();
  };

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-40')}>
      <div className="flex items-center justify-between gap-4">
        <label
          className={cn('flex gap-1 text-sm font-medium text-white/50', error && 'text-primary')}
        >
          {label}
          {error && (
            <Tooltip type="error" label={error}>
              <Icon name="warning" className="opacity-100 text-primary" />
            </Tooltip>
          )}
        </label>
        <span className="text-sm font-bold text-white">
          {normalized.startSeconds === 0 && normalized.endSeconds === max
            ? t('exportSettings.trimFull')
            : `${formatTimecode(normalized.startSeconds)} - ${formatTimecode(normalized.endSeconds)}`}
        </span>
      </div>

      <div
        ref={trackRef}
        className="relative h-2"
        onPointerMove={handleTrackPointerMove}
        onPointerLeave={handleTrackPointerLeave}
      >
        {previewDataUrl != null &&
          previewFrameSize != null &&
          previewAnchorPoint != null &&
          scrubPreview != null &&
          activePreviewFrame != null &&
          activePreviewTimecode != null && (
            <ScrubPreviewPopover
              open
              anchorPoint={previewAnchorPoint}
              imageUrl={previewDataUrl}
              frameWidth={previewFrameSize.width}
              frameHeight={previewFrameSize.height}
              tileWidth={scrubPreview.tileWidth}
              tileHeight={scrubPreview.tileHeight}
              columns={scrubPreview.columns}
              rows={scrubPreview.rows}
              tileColumn={activePreviewFrame.tileColumn}
              tileRow={activePreviewFrame.tileRow}
              timecode={activePreviewTimecode}
              offset={PREVIEW_POPOVER_OFFSET_PX}
            />
          )}
        <div className="absolute inset-0 rounded-lg bg-white/10" />
        <div
          className={cn(
            'absolute top-0 z-10 h-2 rounded-lg bg-linear-to-r from-primary/50 to-primary',
            canDragSelectedRange
              ? 'touch-none cursor-grab select-none active:cursor-grabbing'
              : 'pointer-events-none',
            isDraggingRange && 'cursor-grabbing'
          )}
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`
          }}
          onPointerDown={handleSelectedRangePointerDown}
          onPointerMove={handleSelectedRangePointerMove}
          onPointerUp={handleSelectedRangePointerUp}
          onPointerCancel={handleSelectedRangePointerUp}
          onLostPointerCapture={clearRangeDrag}
        />
        <input
          aria-label={startLabel}
          type="range"
          min={0}
          max={duration}
          step={1}
          disabled={disabled || duration <= TRIM_MIN_LENGTH_SECONDS}
          value={normalized.startSeconds}
          onChange={(event) =>
            commitRange(
              Math.min(
                Number(event.currentTarget.value),
                normalized.endSeconds - TRIM_MIN_LENGTH_SECONDS
              ),
              normalized.endSeconds
            )
          }
          onPointerDown={handleThumbPointerDown('start')}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={() => setDraggingThumb(null)}
          onLostPointerCapture={() => setDraggingThumb(null)}
          className={`
            absolute inset-0 h-2 w-full appearance-none bg-transparent pointer-events-none z-20
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:transition-all
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-3.5
            [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:bg-white
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125'}
          `}
        />
        <input
          aria-label={endLabel}
          type="range"
          min={0}
          max={duration}
          step={1}
          disabled={disabled || duration <= TRIM_MIN_LENGTH_SECONDS}
          value={normalized.endSeconds}
          onChange={(event) =>
            commitRange(
              normalized.startSeconds,
              Math.max(
                Number(event.currentTarget.value),
                normalized.startSeconds + TRIM_MIN_LENGTH_SECONDS
              )
            )
          }
          onPointerDown={handleThumbPointerDown('end')}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={() => setDraggingThumb(null)}
          onLostPointerCapture={() => setDraggingThumb(null)}
          className={`
            absolute inset-0 h-2 w-full appearance-none bg-transparent pointer-events-none z-30
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:transition-all
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-3.5
            [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:bg-white
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125'}
          `}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1 text-[10px] text-white/50">
          {startLabel}
          <input
            aria-label={startLabel}
            type="text"
            value={startText}
            disabled={disabled}
            onFocus={() =>
              setDraft({ field: 'start', text: formatTimecode(normalized.startSeconds) })
            }
            onChange={(event) => setDraft({ field: 'start', text: event.currentTarget.value })}
            onBlur={commitStartText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            className="py-1 text-[10px] font-medium text-white outline-none transition-colors disabled:cursor-not-allowed"
          />
        </label>
        <label className="flex items-center justify-end gap-1 text-[10px] text-white/50">
          <input
            aria-label={endLabel}
            type="text"
            value={endText}
            disabled={disabled}
            onFocus={() => setDraft({ field: 'end', text: formatTimecode(normalized.endSeconds) })}
            onChange={(event) => setDraft({ field: 'end', text: event.currentTarget.value })}
            onBlur={commitEndText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            className="py-1 text-[10px] text-right font-medium text-white outline-none transition-colors disabled:cursor-not-allowed"
          />
          {endLabel}
        </label>
      </div>
    </div>
  );
}
