import React from 'react';

// SVG art for catalog items. Two exports:
//   <ItemArt item size />        - standalone catalog tile
//   hatShape/faceFeatures/...    - primitives reused by components/avatarArt

const TILE_BG = (
  <>
    <defs>
      <linearGradient id="itemTileBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#dfe7ee" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#itemTileBg)" />
  </>
);

// ---- hats: drawn relative to (cx, baseY) where baseY is the head-top line,
// unit scale 1 = 100px tile. On avatars, scale = headWidth/100. ----
export const hatShape = (shape, colors = {}, cx = 50, baseY = 52, s = 1) => {
  const c = (k, d) => colors[k] || d;
  const t = `translate(${cx} ${baseY}) scale(${s})`;
  switch (shape) {
    case 'cap':
      return (
        <g transform={t}>
          <path d="M -28 0 A 28 26 0 0 1 28 0 Z" fill={c('main', '#d62d20')} />
          <rect x="2" y="-4" width="34" height="8" rx="3" fill={c('main', '#d62d20')} />
          <rect x="-28" y="-2" width="56" height="5" rx="2" fill={c('accent', '#fff')} opacity="0.9" />
        </g>
      );
    case 'tophat':
      return (
        <g transform={t}>
          <rect x="-32" y="-4" width="64" height="8" rx="3" fill={c('main', '#1c1c22')} />
          <rect x="-19" y="-40" width="38" height="38" rx="3" fill={c('main', '#1c1c22')} />
          <rect x="-19" y="-14" width="38" height="8" fill={c('accent', '#8b1e1e')} />
        </g>
      );
    case 'crown':
      return (
        <g transform={t}>
          <path
            d="M -26 0 L -26 -22 L -14 -12 L 0 -28 L 14 -12 L 26 -22 L 26 0 Z"
            fill={c('main', '#f5c518')}
          />
          <rect x="-26" y="-4" width="52" height="8" rx="2" fill={c('main', '#f5c518')} />
          <circle cx="0" cy="-12" r="4" fill={c('accent', '#e04343')} />
          <circle cx="-15" cy="-6" r="3" fill={c('accent', '#e04343')} />
          <circle cx="15" cy="-6" r="3" fill={c('accent', '#e04343')} />
        </g>
      );
    case 'halo':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="-22" rx="24" ry="8" fill="none" stroke={c('main', '#ffe97a')} strokeWidth="6" />
          <ellipse cx="0" cy="-22" rx="24" ry="8" fill="none" stroke={c('accent', '#fff6cf')} strokeWidth="2" />
        </g>
      );
    case 'bandana':
      return (
        <g transform={t}>
          <rect x="-28" y="-16" width="56" height="14" rx="3" fill={c('main', '#b3242c')} />
          <path d="M 22 -12 L 36 -20 L 34 -4 Z" fill={c('accent', '#7d1720')} />
          <circle cx="-6" cy="-9" r="2" fill={c('accent', '#7d1720')} />
          <circle cx="6" cy="-9" r="2" fill={c('accent', '#7d1720')} />
        </g>
      );
    case 'party':
      return (
        <g transform={t}>
          <path d="M -18 0 L 0 -40 L 18 0 Z" fill={c('main', '#3fc1c9')} />
          <path d="M -12 -12 L 12 -12 L 9 -20 L -9 -20 Z" fill={c('accent', '#ff6b6b')} />
          <circle cx="0" cy="-42" r="6" fill={c('accent', '#ff6b6b')} />
        </g>
      );
    case 'antenna':
      return (
        <g transform={t}>
          <path d="M -22 0 A 22 18 0 0 1 22 0 Z" fill={c('main', '#9aa5b1')} />
          <rect x="-2" y="-34" width="4" height="20" fill={c('main', '#9aa5b1')} />
          <circle cx="0" cy="-38" r="7" fill={c('accent', '#ff6b6b')} />
        </g>
      );
    case 'wings':
      return (
        <g transform={t}>
          <path d="M -6 -6 C -30 -34 -58 -30 -52 -4 C -46 14 -20 12 -6 -6 Z" fill={c('main', '#2e7d4f')} />
          <path d="M 6 -6 C 30 -34 58 -30 52 -4 C 46 14 20 12 6 -6 Z" fill={c('main', '#2e7d4f')} />
          <path d="M -12 -8 C -28 -26 -44 -24 -40 -8 Z" fill={c('accent', '#1c5233')} />
          <path d="M 12 -8 C 28 -26 44 -24 40 -8 Z" fill={c('accent', '#1c5233')} />
        </g>
      );
    default:
      return null;
  }
};

// ---- faces: features inside a head rect (x, y, w, h) ----
export const faceFeatures = (shape, colors = {}, x = 20, y = 20, w = 60, h = 60) => {
  const c = (k, d) => colors[k] || d;
  const ink = c('main', '#222831');
  const eyeY = y + h * 0.38;
  const lx = x + w * 0.32;
  const rx = x + w * 0.68;
  switch (shape) {
    case 'cool':
      return (
        <g>
          <rect x={x + w * 0.16} y={eyeY - h * 0.1} width={w * 0.28} height={h * 0.18} rx={h * 0.05} fill={c('accent', '#2b2f36')} />
          <rect x={x + w * 0.56} y={eyeY - h * 0.1} width={w * 0.28} height={h * 0.18} rx={h * 0.05} fill={c('accent', '#2b2f36')} />
          <rect x={x + w * 0.42} y={eyeY - h * 0.02} width={w * 0.16} height={h * 0.05} fill={c('accent', '#2b2f36')} />
          <path d={`M ${x + w * 0.35} ${y + h * 0.68} Q ${x + w * 0.5} ${y + h * 0.8} ${x + w * 0.65} ${y + h * 0.68}`} stroke={ink} strokeWidth={h * 0.05} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'determined':
      return (
        <g>
          <circle cx={lx} cy={eyeY} r={h * 0.05} fill={ink} />
          <circle cx={rx} cy={eyeY} r={h * 0.05} fill={ink} />
          <path d={`M ${lx - w * 0.1} ${eyeY - h * 0.12} L ${lx + w * 0.08} ${eyeY - h * 0.05}`} stroke={ink} strokeWidth={h * 0.05} strokeLinecap="round" />
          <path d={`M ${rx + w * 0.1} ${eyeY - h * 0.12} L ${rx - w * 0.08} ${eyeY - h * 0.05}`} stroke={ink} strokeWidth={h * 0.05} strokeLinecap="round" />
          <path d={`M ${x + w * 0.38} ${y + h * 0.72} L ${x + w * 0.62} ${y + h * 0.72}`} stroke={ink} strokeWidth={h * 0.05} strokeLinecap="round" />
        </g>
      );
    case 'sleepy':
      return (
        <g>
          <path d={`M ${lx - w * 0.08} ${eyeY} Q ${lx} ${eyeY + h * 0.08} ${lx + w * 0.08} ${eyeY}`} stroke={ink} strokeWidth={h * 0.05} fill="none" strokeLinecap="round" />
          <path d={`M ${rx - w * 0.08} ${eyeY} Q ${rx} ${eyeY + h * 0.08} ${rx + w * 0.08} ${eyeY}`} stroke={ink} strokeWidth={h * 0.05} fill="none" strokeLinecap="round" />
          <ellipse cx={x + w * 0.5} cy={y + h * 0.72} rx={w * 0.07} ry={h * 0.05} fill={ink} />
          <text x={x + w * 0.78} y={y + h * 0.28} fontSize={h * 0.16} fill={ink} opacity="0.7">z</text>
          <text x={x + w * 0.88} y={y + h * 0.16} fontSize={h * 0.2} fill={ink} opacity="0.5">z</text>
        </g>
      );
    case 'smile':
    default:
      return (
        <g>
          <circle cx={lx} cy={eyeY} r={h * 0.05} fill={ink} />
          <circle cx={rx} cy={eyeY} r={h * 0.05} fill={ink} />
          <path d={`M ${x + w * 0.33} ${y + h * 0.62} Q ${x + w * 0.5} ${y + h * 0.8} ${x + w * 0.67} ${y + h * 0.62}`} stroke={ink} strokeWidth={h * 0.05} fill="none" strokeLinecap="round" />
        </g>
      );
  }
};

// ---- shirt/pants helpers ----
export const shirtColors = (art) => ({
  torso: (art && art.colors && art.colors.torso) || null,
  sleeve: (art && art.colors && art.colors.sleeve) || null,
  accent: (art && art.colors && art.colors.accent) || '#ffffff',
  shape: (art && art.shape) || 'tee',
});

// Torso overlay accents drawn over a torso rect (x,y,w,h).
export const shirtAccent = (shape, colors, x, y, w, h) => {
  const accent = (colors && colors.accent) || '#ffffff';
  switch (shape) {
    case 'striped':
      return (
        <g>
          <rect x={x} y={y + h * 0.22} width={w} height={h * 0.12} fill={accent} />
          <rect x={x} y={y + h * 0.5} width={w} height={h * 0.12} fill={accent} />
          <rect x={x} y={y + h * 0.78} width={w} height={h * 0.12} fill={accent} />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          <path d={`M ${x + w * 0.2} ${y} Q ${x + w * 0.5} ${y - h * 0.18} ${x + w * 0.8} ${y}`} fill={accent} />
          <rect x={x + w * 0.25} y={y + h * 0.62} width={w * 0.5} height={h * 0.14} rx={h * 0.03} fill={accent} opacity="0.5" />
        </g>
      );
    case 'suit':
      return (
        <g>
          <path d={`M ${x + w * 0.5} ${y} L ${x + w * 0.28} ${y + h * 0.32} L ${x + w * 0.5} ${y + h * 0.5} L ${x + w * 0.72} ${y + h * 0.32} Z`} fill="#f2f2f2" />
          <path d={`M ${x + w * 0.5} ${y + h * 0.12} L ${x + w * 0.42} ${y + h * 0.3} L ${x + w * 0.5} ${y + h * 0.62} L ${x + w * 0.58} ${y + h * 0.3} Z`} fill={accent} />
        </g>
      );
    default:
      return null;
  }
};

export const pantsColors = (art) => ({
  main: (art && art.colors && art.colors.main) || null,
  accent: (art && art.colors && art.colors.accent) || '#00000033',
  shape: (art && art.shape) || 'jeans',
});

export const pantsAccent = (shape, colors, x, y, w, h) => {
  const accent = (colors && colors.accent) || 'rgba(0,0,0,0.2)';
  switch (shape) {
    case 'cargo':
      return (
        <g>
          <rect x={x + w * 0.1} y={y + h * 0.35} width={w * 0.32} height={h * 0.22} rx={2} fill={accent} />
          <rect x={x + w * 0.58} y={y + h * 0.35} width={w * 0.32} height={h * 0.22} rx={2} fill={accent} />
        </g>
      );
    case 'slacks':
      return (
        <g>
          <rect x={x + w * 0.3} y={y} width={w * 0.06} height={h} fill={accent} />
          <rect x={x + w * 0.64} y={y} width={w * 0.06} height={h} fill={accent} />
        </g>
      );
    default:
      return null;
  }
};

export const gearShape = (shape, colors = {}, cx = 50, cy = 55, s = 1) => {
  const c = (k, d) => colors[k] || d;
  const t = `translate(${cx} ${cy}) scale(${s})`;
  switch (shape) {
    case 'sword':
      return (
        <g transform={t}>
          <path d="M -4 22 L -12 6 L 2 -34 L 10 -34 L 10 6 Z" fill={c('main', '#9aa5b1')} transform="rotate(25)" />
          <rect x="-16" y="14" width="26" height="6" rx="2" fill="#5c4023" transform="rotate(25)" />
          <rect x="-4" y="18" width="7" height="16" rx="2" fill={c('accent', '#6b4f2a')} transform="rotate(25)" />
        </g>
      );
    case 'boombox':
      return (
        <g transform={t}>
          <rect x="-26" y="-14" width="52" height="30" rx="4" fill={c('main', '#3a3f47')} />
          <circle cx="-13" cy="1" r="9" fill={c('accent', '#c8372d')} />
          <circle cx="13" cy="1" r="9" fill={c('accent', '#c8372d')} />
          <circle cx="-13" cy="1" r="4" fill="#222" />
          <circle cx="13" cy="1" r="4" fill="#222" />
          <rect x="-8" y="-20" width="16" height="8" rx="3" fill={c('main', '#3a3f47')} />
          <rect x="-16" y="-10" width="10" height="4" rx="1" fill="#9aa5b1" />
        </g>
      );
    case 'coil':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="16" rx="16" ry="5" fill={c('accent', '#2b8a91')} />
          <path d="M -14 8 A 14 8 0 1 1 14 8 A 14 8 0 1 1 -14 8" fill="none" stroke={c('main', '#3fc1c9')} strokeWidth="5" />
          <path d="M -12 -2 A 12 7 0 1 1 12 -2 A 12 7 0 1 1 -12 -2" fill="none" stroke={c('main', '#3fc1c9')} strokeWidth="5" />
          <path d="M -10 -12 A 10 6 0 1 1 10 -12 A 10 6 0 1 1 -10 -12" fill="none" stroke={c('main', '#3fc1c9')} strokeWidth="5" />
        </g>
      );
    default:
      return null;
  }
};

// Standalone catalog tile.
const ItemArt = ({ item, size = 120 }) => {
  const art = (item && item.art) || {};
  const type = art.type || 'hat';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', borderRadius: 6 }}>
      {TILE_BG}
      {type === 'hat' && hatShape(art.shape, art.colors, 50, 58, 1)}
      {type === 'face' && (
        <g>
          <rect x="22" y="18" width="56" height="56" rx="8" fill="#f5cd30" />
          <rect x="22" y="74" width="56" height="8" rx="3" fill="#d8b12a" />
          {faceFeatures(art.shape, art.colors, 22, 18, 56, 56)}
        </g>
      )}
      {type === 'shirt' && (
        <g>
          <rect x="16" y="30" width="14" height="44" rx="3" fill={(art.colors && art.colors.sleeve) || '#2e6db4'} />
          <rect x="70" y="30" width="14" height="44" rx="3" fill={(art.colors && art.colors.sleeve) || '#2e6db4'} />
          <rect x="30" y="24" width="40" height="52" rx="4" fill={(art.colors && art.colors.torso) || '#2e6db4'} />
          {shirtAccent(art.shape, art.colors, 30, 24, 40, 52)}
        </g>
      )}
      {type === 'pants' && (
        <g>
          <rect x="28" y="22" width="44" height="16" rx="3" fill={(art.colors && art.colors.main) || '#2b4a8b'} />
          <rect x="28" y="38" width="19" height="40" rx="3" fill={(art.colors && art.colors.main) || '#2b4a8b'} />
          <rect x="53" y="38" width="19" height="40" rx="3" fill={(art.colors && art.colors.main) || '#2b4a8b'} />
          {pantsAccent(art.shape, art.colors, 28, 38, 44, 40)}
        </g>
      )}
      {type === 'gear' && gearShape(art.shape, art.colors, 50, 50, 1.1)}
    </svg>
  );
};

export default ItemArt;
