import type { ReactNode } from 'react'

type TooltipProps = {
  label: string
  children: ReactNode
}

export function Tooltip({ label, children }: TooltipProps): React.JSX.Element {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs text-black shadow-lg group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  )
}
