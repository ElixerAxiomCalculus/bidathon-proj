/**
 * FinAlly Logo — SVG icon component.
 *
 * A stylised "F" integrated with a rising trend-line, set on a rounded-square
 * blue background. Used in:
 *  - Landing Navbar (beside "FinAlly" text)
 *  - Dashboard Navbar
 *  - Chat loader animation
 */

const FinAllyLogo = ({ size = 32, className = '', spinning = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`finally-logo ${spinning ? 'finally-logo--spin' : ''} ${className}`}
    aria-label="FinAlly logo"
  >
    {/* ── Outer rounded-square background ── */}
    <rect width="36" height="36" rx="9" fill="url(#fa-grad)" />

    {/* ── Stylised F ── */}
    {/* Vertical stem */}
    <rect x="10" y="9" width="3.5" height="18" rx="1.75" fill="white" />
    {/* Top arm */}
    <rect x="10" y="9" width="15" height="3.5" rx="1.75" fill="white" />
    {/* Mid arm */}
    <rect x="10" y="17.5" width="10.5" height="3" rx="1.5" fill="white" />

    {/* ── Rising trend sparkline (attached to the F mid-arm) ── */}
    <polyline
      points="22,26 25,22 28,24 31,19"
      stroke="rgba(255,255,255,0.65)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Trend arrow tip */}
    <polyline
      points="29,18 31,19 30,21"
      stroke="rgba(255,255,255,0.65)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* ── Gradient definition ── */}
    <defs>
      <linearGradient id="fa-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0477e0" />
        <stop offset="100%" stopColor="#0353a4" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Animated chat loader — spinning ring around the FinAlly logo.
 * Replaces the plain three-dot loader in the chat area.
 */
export const FinAllyLoader = ({ size = 44 }) => (
  <div className="fa-loader" style={{ width: size, height: size }}>
    {/* Spinning arc ring */}
    <svg
      className="fa-loader__ring"
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Faint full ring */}
      <circle cx="22" cy="22" r="19" stroke="rgba(4,102,200,0.15)" strokeWidth="2" />
      {/* Animated arc — CSS handles the spin */}
      <circle
        cx="22"
        cy="22"
        r="19"
        stroke="#0466C8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="32 88"
        strokeDashoffset="0"
        className="fa-loader__arc"
      />
    </svg>

    {/* Static logo in the centre */}
    <div className="fa-loader__center">
      <FinAllyLogo size={24} />
    </div>
  </div>
);

export default FinAllyLogo;
