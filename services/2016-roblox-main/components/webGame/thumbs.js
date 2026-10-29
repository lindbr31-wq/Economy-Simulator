import React from 'react';

// Hand-drawn SVG thumbnails for the games grid (no external assets).
const SkyObbyThumb = () => (
  <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6ec6ff" />
        <stop offset="1" stopColor="#c9ecff" />
      </linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#skyG)" />
    <ellipse cx="60" cy="36" rx="34" ry="12" fill="#fff" opacity="0.9" />
    <ellipse cx="86" cy="28" rx="22" ry="10" fill="#fff" opacity="0.9" />
    <ellipse cx="250" cy="52" rx="30" ry="11" fill="#fff" opacity="0.8" />
    <rect x="30" y="140" width="90" height="14" fill="#3b6ea5" />
    <rect x="150" y="112" width="80" height="14" fill="#e08a2e" />
    <rect x="230" y="82" width="70" height="14" fill="#7b4fc0" />
    <rect x="110" y="56" width="76" height="14" fill="#3b6ea5" />
    <circle cx="188" cy="96" r="8" fill="#f5c518" stroke="#c79a12" strokeWidth="2.5" />
    <rect x="60" y="118" width="12" height="10" fill="#f5cd30" />
    <rect x="58" y="128" width="16" height="12" fill="#0d69ac" />
  </svg>
);

const BrickBustersThumb = () => (
  <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <rect width="320" height="180" fill="#141b2d" />
    {['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71'].map((color, r) => (
      <g key={r}>
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <rect key={c} x={14 + c * 43} y={16 + r * 18} width={38} height={13} fill={color} rx="2" />
        ))}
      </g>
    ))}
    <rect x="120" y="162" width="80" height="10" rx="5" fill="#e8eef5" />
    <circle cx="196" cy="132" r="7" fill="#fff" />
  </svg>
);

const CrossyCanyonThumb = () => (
  <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <rect width="320" height="180" fill="#6fbf5e" />
    <rect y="40" width="320" height="46" fill="#4a4f57" />
    <rect y="112" width="320" height="46" fill="#3a86c8" />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <rect key={i} x={i * 50 + 8} y="60" width="26" height="5" fill="#c9c943" />
    ))}
    <rect x="36" y="48" width="70" height="28" rx="5" fill="#c8372d" />
    <rect x="86" y="53" width="22" height="11" rx="2" fill="rgba(255,255,255,0.4)" />
    <rect x="180" y="50" width="86" height="26" rx="5" fill="#3498db" />
    <rect x="40" y="122" width="110" height="24" rx="4" fill="#8a5a2b" />
    <rect x="200" y="122" width="90" height="24" rx="4" fill="#8a5a2b" />
    <rect x="150" y="86" width="14" height="11" fill="#f5cd30" />
    <rect x="148" y="97" width="18" height="13" fill="#0d69ac" />
    <rect x="149" y="110" width="7" height="9" fill="#4b974b" />
    <rect x="158" y="110" width="7" height="9" fill="#4b974b" />
  </svg>
);

const GameThumb = ({ game }) => {
  const key = (game && (game.thumb_key || game.thumbKey)) || '';
  if (key === 'brickBusters') return <BrickBustersThumb />;
  if (key === 'crossyCanyon') return <CrossyCanyonThumb />;
  return <SkyObbyThumb />;
};

export default GameThumb;
