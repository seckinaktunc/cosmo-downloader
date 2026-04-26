import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DownloadLogReadResult } from '../../../../shared/types';
import { getBottomScrollState } from '../../lib/bottomScroll';
import { appendLiveLogLines, LOG_TAIL_BYTES } from '../../lib/logContent';
import { resolveDisplayedLogSource } from '../../lib/logSources';
import { useHistoryStore } from '../../stores/historyStore';
import { useQueueStore } from '../../stores/queueStore';
import { useUiStore } from '../../stores/uiStore';
import { useVideoStore } from '../../stores/videoStore';
import { Button } from '../ui/Button';
import Icon from '../miscellaneous/Icon';

export function LogsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const queueItems = useQueueStore((state) => state.items);
  const historyEntries = useHistoryStore((state) => state.entries);
  const activeExportTarget = useUiStore((state) => state.activeExportTarget);
  const previewFetchLog = useVideoStore((state) => state.activeFetchLog);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [logResult, setLogResult] = useState<DownloadLogReadResult | null>(null);
  const [loadingLogPath, setLoadingLogPath] = useState<string | null>(null);
  const [error, setError] = useState<{ logPath: string; message: string } | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const selectedSource = useMemo(
    () =>
      resolveDisplayedLogSource({
        activeExportTarget,
        queueItems,
        historyEntries,
        previewFetchLog,
        titleFallback: t('logs.unknownDownload')
      }),
    [activeExportTarget, historyEntries, previewFetchLog, queueItems, t]
  );
  const selectedLogPath = selectedSource?.logPath ?? null;
  const selectedLogResult = logResult?.logPath === selectedLogPath ? logResult : null;
  const loading = loadingLogPath === selectedLogPath;
  const errorMessage = error?.logPath === selectedLogPath ? error.message : null;

  const updateScrollState = useCallback((): void => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const scrollState = getBottomScrollState(element);
    setAutoFollow(scrollState.nearBottom);
    setShowScrollToBottom(scrollState.showScrollToBottom);
  }, []);

  useEffect(() => {
    setAutoFollow(true);
    setShowScrollToBottom(false);
    setCopyFeedback(null);
  }, [selectedLogPath]);

  useEffect(() => {
    if (!copyFeedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopyFeedback(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => {
    if (!selectedLogPath) {
      setLogResult(null);
      setLoadingLogPath(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const loadLog = async (): Promise<void> => {
      setLoadingLogPath(selectedLogPath);
      setError(null);

      try {
        const result = await window.cosmo.logs.read({
          logPath: selectedLogPath,
          maxBytes: LOG_TAIL_BYTES
        });
        if (cancelled) {
          return;
        }

        if (result.ok) {
          setLogResult(result.data);
        } else {
          setLogResult(null);
          setError({ logPath: selectedLogPath, message: result.error.message });
        }
      } catch (readError) {
        if (cancelled) {
          return;
        }

        setLogResult(null);
        setError({
          logPath: selectedLogPath,
          message: readError instanceof Error ? readError.message : String(readError)
        });
      } finally {
        if (!cancelled) {
          setLoadingLogPath((current) => (current === selectedLogPath ? null : current));
        }
      }
    };

    void loadLog();

    return () => {
      cancelled = true;
    };
  }, [selectedLogPath]);

  useEffect(() => {
    return window.cosmo.logs.onAppend((append) => {
      if (append.logPath !== selectedLogPath) {
        return;
      }

      setLogResult((current) => appendLiveLogLines(current, append, selectedLogPath));
    });
  }, [selectedLogPath]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (autoFollow) {
        element.scrollTop = element.scrollHeight;
      }
      updateScrollState();
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFollow, loading, selectedLogResult?.content, updateScrollState]);

  const revealLog = async (): Promise<void> => {
    if (!selectedLogPath) {
      return;
    }

    const result = await window.cosmo.shell.openPath({ path: selectedLogPath });
    if (!result.ok) {
      setError({ logPath: selectedLogPath, message: result.error.message });
    }
  };

  const copyText = async (text: string): Promise<void> => {
    setCopyFeedback(null);

    try {
      const result = await window.cosmo.clipboard.writeText(text);
      if (result.ok) {
        setCopyFeedback(t('logs.feedback.copied'));
        return;
      }

      setError({ logPath: selectedLogPath ?? '', message: result.error.message });
      setCopyFeedback(t('logs.feedback.copyFailed'));
    } catch (copyError) {
      setError({
        logPath: selectedLogPath ?? '',
        message: copyError instanceof Error ? copyError.message : String(copyError)
      });
      setCopyFeedback(t('logs.feedback.copyFailed'));
    }
  };

  const handleScroll = (): void => {
    updateScrollState();
  };

  const scrollToBottom = (): void => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
    setAutoFollow(true);
    setShowScrollToBottom(false);
  };

  return (
    <section className="grid h-full min-h-0 grid-rows-[1fr_auto] divide-y divide-white/10 text-white">
      <div className="relative min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto min-w-0 selection:bg-white selection:text-black"
          onScroll={handleScroll}
        >
          {!selectedLogPath ? (
            <span className="flex items-center justify-center w-full h-full text-white/25">
              {t('logs.emptyLog')}
            </span>
          ) : loading ? (
            <div className="flex items-center justify-center w-full h-full">
              <Icon name="spinner" size={32} className="opacity-50" />
            </div>
          ) : errorMessage ? (
            <div className="p-4 text-sm text-primary">{errorMessage}</div>
          ) : selectedLogResult ? (
            <div className="grid min-h-full grid-rows-[auto_minmax(0,1fr)]">
              {selectedLogResult.truncated ? (
                <div className="border-b border-white/10 bg-yellow/10 px-4 py-2 text-xs text-yellow">
                  {t('logs.truncated')}
                </div>
              ) : null}
              <pre className="select-text min-w-0 whitespace-pre-wrap wrap-break-word p-4 font-mono text-xs leading-relaxed text-white/50">
                {selectedLogResult.content || t('logs.emptyLog')}

                {showScrollToBottom ? (
                  <div className="absolute flex items-end justify-center bottom-0 -left-3 w-full h-32 pl-3 bg-linear-to-b from-transparent to-dark to-95% pointer-events-none">
                    <Button
                      icon="chevronsDown"
                      label={t('actions.scrollToBottom')}
                      className="w-full rounded-none border-none pointer-events-auto"
                      onClick={scrollToBottom}
                      onlyIcon
                      ghost
                    />
                  </div>
                ) : null}
              </pre>
            </div>
          ) : (
            <div className="p-4 text-sm text-white/40">{t('logs.noSelectionDetail')}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 min-w-0 divide-x divide-white/10 bg-dark">
        <div className="w-full">
          <Button
            icon="folderOpen"
            label={t('logs.actions.openFolder')}
            size="lg"
            className="w-full rounded-none border-none"
            disabled={!selectedLogPath}
            onClick={() => void revealLog()}
          />
        </div>
        <div className="w-full">
          <Button
            icon="copy"
            label={t('logs.actions.copyLogs')}
            tooltip={copyFeedback ?? t('logs.actions.copyLogs')}
            size="lg"
            className="w-full rounded-none border-none"
            tooltipClassName="w-full"
            disabled={!selectedLogResult?.content}
            onClick={() => void copyText(selectedLogResult?.content ?? '')}
          />
        </div>
      </div>
    </section>
  );
}
