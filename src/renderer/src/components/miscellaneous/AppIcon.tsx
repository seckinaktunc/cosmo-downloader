type AppIconProps = {
  color?: string
  className?: string
  style?: React.CSSProperties
  stroke?: number
}

export default function AppIcon({ color, className, style }: AppIconProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 651.8 697.34"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M418.78 527.65h229.17C587.03 629.3 475.8 697.34 348.67 697.34 156.11 697.34 0 541.23 0 348.67S156.11 0 348.67 0C478.53 0 591.8 71 651.8 176.29H418.78c-35.04 0-63.44 28.4-63.44 63.43l36.58 45.3-36.58-25.14-26.24-18.03-82.57-56.76c-32.89-22.61-77.64.94-77.64 40.85V478c0 39.9 44.75 63.45 77.64 40.84l79.49-54.63h-.12l66.02-45.34-36.58 45.34c0 35.03 28.4 63.44 63.44 63.44z"
        fill={color ?? 'currentColor'}
      />
    </svg>
  )
}
