export function CrystalBallScene() {
  return (
    <div className="crystal-scene" aria-hidden="true">
      <svg viewBox="0 0 1280 620" role="presentation">
        <defs>
          <radialGradient id="ball-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0" stopColor="#d9f3ff" stopOpacity="0.9" />
            <stop offset="0.7" stopColor="#9bcbe4" stopOpacity="0.35" />
            <stop offset="1" stopColor="#6d87d3" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ecfbff" stopOpacity="0.9" />
            <stop offset="0.55" stopColor="#a6cdec" stopOpacity="0.35" />
            <stop offset="1" stopColor="#6f8ad2" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#258baa" />
            <stop offset="1" stopColor="#0b526f" />
          </linearGradient>
          <filter id="soft-blur"><feGaussianBlur stdDeviation="16" /></filter>
        </defs>
        <ellipse cx="640" cy="350" rx="300" ry="220" fill="#a8caff" opacity="0.22" filter="url(#soft-blur)" />
        <g className="scene-stars" fill="#f8e8b0">
          <circle cx="312" cy="100" r="3" /><circle cx="1000" cy="106" r="3" /><circle cx="220" cy="165" r="2" /><circle cx="1080" cy="300" r="2" />
        </g>
        <circle cx="640" cy="294" r="208" fill="url(#ball-glow)" />
        <circle cx="640" cy="294" r="164" fill="url(#glass)" stroke="#d5efff" strokeWidth="5" strokeOpacity="0.8" />
        <ellipse cx="590" cy="220" rx="54" ry="38" fill="#fff" opacity="0.34" transform="rotate(-28 590 220)" />
        <circle cx="598" cy="205" r="17" fill="#fff" opacity="0.55" />
        <g className="scene-mist" fill="none" stroke="#fff" strokeLinecap="round" opacity="0.58">
          <path d="M548 340c38-36 74-24 105 0s63 28 91-8" strokeWidth="9" />
          <path d="M582 374c30-22 59-20 83 0s47 22 73-4" strokeWidth="6" />
        </g>
        <path d="M490 448c33-24 267-24 300 0l-22 58c-35 35-221 35-256 0l-22-58Z" fill="url(#base)" stroke="#071d34" strokeWidth="7" />
        <ellipse cx="640" cy="449" rx="150" ry="29" fill="#d9f3ff" stroke="#071d34" strokeWidth="7" />
        <ellipse cx="640" cy="443" rx="116" ry="18" fill="#16234c" />
      </svg>
    </div>
  );
}
