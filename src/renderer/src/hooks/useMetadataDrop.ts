import { useCallback } from 'react'
import { extractDroppedSingleVideoUrl } from '../lib/urlInput'

type MetadataDropHandlers = {
  onDragOver: (event: React.DragEvent<HTMLElement>) => void
  onDrop: (event: React.DragEvent<HTMLElement>) => void
}

export function useMetadataDrop(onUrl: (url: string) => void): MetadataDropHandlers {
  return {
    onDragOver: useCallback((event) => {
      if (extractDroppedSingleVideoUrl(event.dataTransfer)) {
        event.preventDefault()
      }
    }, []),
    onDrop: useCallback(
      (event) => {
        const droppedUrl = extractDroppedSingleVideoUrl(event.dataTransfer)
        if (!droppedUrl) {
          return
        }

        event.preventDefault()
        onUrl(droppedUrl)
      },
      [onUrl]
    )
  }
}
