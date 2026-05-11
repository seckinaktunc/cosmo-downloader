import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VideoMetadata } from '../../../shared/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getSourceUrl(metadata: VideoMetadata): string {
  return metadata.webpageUrl ?? metadata.url;
}
