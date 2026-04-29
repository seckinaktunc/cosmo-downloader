import { useId, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import Icon from '../miscellaneous/Icon';

type CollapsibleSectionProps = {
  title: ReactNode;
  children: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
  headingClassName?: string;
  contentClassName?: string;
};

export function CollapsibleSection({
  title,
  children,
  expanded,
  defaultExpanded = true,
  onExpandedChange,
  className,
  headingClassName,
  contentClassName
}: CollapsibleSectionProps): React.JSX.Element {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const contentId = useId();
  const controlled = expanded != null;
  const resolvedExpanded = controlled ? expanded : uncontrolledExpanded;

  const setExpanded = (nextExpanded: boolean): void => {
    if (!controlled) {
      setUncontrolledExpanded(nextExpanded);
    }

    onExpandedChange?.(nextExpanded);
  };

  return (
    <section className={className}>
      <button
        type="button"
        className={cn(
          'flex items-center w-full cursor-pointer justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70',
          'px-4 py-1 text-white/50 bg-linear-90 from-white/5 to-transparent',
          headingClassName
        )}
        aria-expanded={resolvedExpanded}
        aria-controls={resolvedExpanded ? contentId : undefined}
        onClick={() => setExpanded(!resolvedExpanded)}
      >
        <span className="min-w-0">{title}</span>
        <Icon
          name="chevronDown"
          size={18}
          className={cn('shrink-0 text-white/50', resolvedExpanded && 'rotate-180')}
        />
      </button>

      {resolvedExpanded ? (
        <div
          id={contentId}
          className={cn(
            'grid divide-y divide-white/10 border-t border-white/10 ',
            contentClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
