import { cn } from '@renderer/lib/utils';
import Icon, { type IconName } from './Icon';

const PLATFORM_ICON_MAP: Record<string, IconName> = {
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

type PlatformBadgeProps = {
  platform?: string;
  className?: string;
  iconClassName?: string;
  iconSize?: number;
};

function normalizePlatform(platform: string): string {
  return platform.trim().toLowerCase();
}

export function PlatformBadge({
  platform,
  className,
  iconClassName,
  iconSize = 16
}: PlatformBadgeProps): React.JSX.Element | null {
  const label = platform?.trim();

  if (!label) {
    return null;
  }

  const iconName = PLATFORM_ICON_MAP[normalizePlatform(label)];

  return (
    <span className={cn('inline-flex min-w-0 items-center', iconName && 'gap-2', className)}>
      {iconName ? (
        <Icon name={iconName} size={iconSize} className={cn('shrink-0', iconClassName)} />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
