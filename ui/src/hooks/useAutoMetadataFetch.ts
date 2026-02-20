import { useEffect, useRef } from "react";
import { useFetchMetadata } from "@/hooks/useFetchMetadata";
import { useDownloadStore } from "@/stores/downloadStore";
import { useMetadataStore } from "@/stores/metadataStore";
import { isActiveDownloadStatus } from "@/types/download";
import { isCompleteSupportedVideoUrl } from "@/utils/videoUrlClassifier";

export function useAutoMetadataFetch(): void {
  const fetchMetadata = useFetchMetadata();
  const url = useDownloadStore((state) => state.url);
  const downloadStatus = useDownloadStore((state) => state.status);
  const metadataStatus = useMetadataStore((state) => state.status);
  const metadataSourceUrl = useMetadataStore((state) => state.sourceUrl);
  const previousUrlRef = useRef("");
  const lastAutoFetchedUrlRef = useRef("");

  useEffect(() => {
    const normalizedUrl = url.trim();
    if (previousUrlRef.current !== normalizedUrl) {
      previousUrlRef.current = normalizedUrl;
      lastAutoFetchedUrlRef.current = "";
    }

    if (normalizedUrl.length === 0) {
      lastAutoFetchedUrlRef.current = "";
      return;
    }

    if (!isCompleteSupportedVideoUrl(normalizedUrl)) {
      return;
    }

    if (isActiveDownloadStatus(downloadStatus)) {
      return;
    }

    const hasMetadataForCurrentUrl =
      metadataStatus === "ready" &&
      metadataSourceUrl === normalizedUrl;
    const isFetchInProgressForCurrentUrl =
      metadataStatus === "fetching" &&
      metadataSourceUrl === normalizedUrl;

    if (hasMetadataForCurrentUrl || isFetchInProgressForCurrentUrl) {
      return;
    }

    if (lastAutoFetchedUrlRef.current === normalizedUrl) {
      return;
    }

    lastAutoFetchedUrlRef.current = normalizedUrl;
    fetchMetadata();
  }, [downloadStatus, fetchMetadata, metadataSourceUrl, metadataStatus, url]);
}
