import { IconName } from '@renderer/components/miscellaneous/Icon';
import { CookieBrowser } from '../../../shared/types';

export const COOKIE_BROWSER_ICONS: Record<CookieBrowser, IconName> = {
  none: 'none',
  chrome: 'logos:chrome',
  chromium: 'logos:chrome',
  edge: 'logos:microsoft-edge',
  firefox: 'logos:firefox',
  brave: 'logos:brave',
  opera: 'logos:opera',
  vivaldi: 'logos:vivaldi',
  safari: 'logos:safari',
  whale: 'browser'
};

export const PLATFORM_ICONS: Record<string, IconName> = {
  youtube: 'logos:youtube-icon',
  tiktok: 'logos:tiktok-icon',
  instagram: 'logos:instagram-icon',
  x: 'logos:twitter',
  vimeo: 'logos:vimeo-icon',
  twitch: 'logos:twitch',
  facebook: 'logos:facebook',
  reddit: 'logos:reddit-icon',
  soundcloud: 'logos:soundcloud'
};
