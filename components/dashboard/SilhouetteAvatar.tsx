interface SilhouetteAvatarProps {
  className?: string
}

export function SilhouetteAvatar({ className = '' }: SilhouetteAvatarProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background Circle */}
      <circle cx="48" cy="48" r="48" fill="#F3F4F6" />

      {/* Head */}
      <circle cx="48" cy="36" r="14" fill="#D1D5DB" />

      {/* Body/Shoulders */}
      <path
        d="M24 78C24 64.745 34.745 54 48 54C61.255 54 72 64.745 72 78V96H24V78Z"
        fill="#D1D5DB"
      />
    </svg>
  )
}
