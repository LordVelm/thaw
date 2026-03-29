interface Props {
  size?: number;
  className?: string;
}

/**
 * Thaw app logo — a water droplet with an ice-crystal facet on top,
 * representing frozen debt melting into freedom.
 */
export default function ThawLogo({ size = 48, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background rounded square */}
      <rect width="512" height="512" rx="112" fill="url(#bg)" />

      {/* Droplet body — smooth water */}
      <path
        d="M256 96
           C256 96 152 228 152 320
           C152 377.4 199.6 424 256 424
           C312.4 424 360 377.4 360 320
           C360 228 256 96 256 96Z"
        fill="url(#drop)"
      />

      {/* Ice facet — crystalline highlight on upper portion */}
      <path
        d="M256 96
           L208 240
           L256 216
           L304 240
           Z"
        fill="rgba(255,255,255,0.55)"
      />

      {/* Small shine */}
      <ellipse cx="220" cy="300" rx="20" ry="32" fill="rgba(255,255,255,0.35)" transform="rotate(-15 220 300)" />

      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0b8fef" />
          <stop offset="1" stopColor="#f97356" />
        </linearGradient>
        <linearGradient id="drop" x1="256" y1="96" x2="256" y2="424" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e0f0ff" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f0f8ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
