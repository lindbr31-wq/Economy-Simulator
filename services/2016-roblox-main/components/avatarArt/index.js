import React from 'react';
import { getItemById, DEFAULT_AVATAR } from '../../lib/catalogItems';
import { hatShape, faceFeatures, shirtColors, shirtAccent, pantsColors, pantsAccent, gearShape } from '../itemArt';

// Front-view R6 blocky avatar rendered as SVG. No game server, no 3D -
// pure vector art built from the avatar config + equipped catalog items.
//
// Layout (viewBox 260 x 360):
//   head 76x76 at (92, 26) | torso 84x96 at (88, 112)
//   arms 30x96 at (54/176, 112) | legs 40x100 at (88/132, 212)

const HEAD = { x: 92, y: 26, w: 76, h: 76 };
const TORSO = { x: 88, y: 112, w: 84, h: 96 };
const ARM_L = { x: 54, y: 112, w: 30, h: 96 };
const ARM_R = { x: 176, y: 112, w: 30, h: 96 };
const LEG_L = { x: 88, y: 212, w: 40, h: 100 };
const LEG_R = { x: 132, y: 212, w: 40, h: 100 };

const R6 = (rect, fill, key) => (
  <rect key={key} x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="5" fill={fill} />
);

const AvatarArt = ({ config, size = 300 }) => {
  const cfg = config || DEFAULT_AVATAR;
  const colors = { ...DEFAULT_AVATAR.bodyColors, ...(cfg.bodyColors || {}) };
  const face = cfg.faceId ? getItemById(cfg.faceId) : null;
  const shirt = cfg.shirtId ? getItemById(cfg.shirtId) : null;
  const pants = cfg.pantsId ? getItemById(cfg.pantsId) : null;
  const gear = cfg.gearId ? getItemById(cfg.gearId) : null;
  const hats = (cfg.hatIds || []).map(getItemById).filter(Boolean);

  const shirtC = shirtColors(shirt && shirt.art);
  const pantsC = pantsColors(pants && pants.art);

  const armFillL = shirtC.sleeve || colors.leftArm;
  const armFillR = shirtC.sleeve || colors.rightArm;
  const torsoFill = shirtC.torso || colors.torso;
  const legFillL = pantsC.main || colors.leftLeg;
  const legFillR = pantsC.main || colors.rightLeg;

  return (
    <svg
      width={size}
      height={(size * 360) / 260}
      viewBox="0 0 260 360"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* subtle floor shadow */}
      <ellipse cx="130" cy="336" rx="86" ry="12" fill="rgba(0,0,0,0.12)" />

      {/* back hat layer (wings) */}
      {hats
        .filter((h) => h.art && h.art.shape === 'wings')
        .map((h, i) => (
          <g key={'wing' + i}>{hatShape('wings', h.art.colors, HEAD.x + HEAD.w / 2, HEAD.y + HEAD.h * 0.55, 1.15)}</g>
        ))}

      {R6(LEG_L, legFillL, 'll')}
      {R6(LEG_R, legFillR, 'lr')}
      {pantsC.shape && pantsAccent(pantsC.shape, pantsC, LEG_L.x, LEG_L.y, LEG_R.x + LEG_R.w - LEG_L.x, LEG_L.h)}

      {R6(ARM_L, armFillL, 'al')}
      {R6(ARM_R, armFillR, 'ar')}
      {R6(TORSO, torsoFill, 'to')}
      {shirtC.shape && shirtAccent(shirtC.shape, shirtC, TORSO.x, TORSO.y, TORSO.w, TORSO.h)}

      {R6(HEAD, colors.head, 'hd')}
      {face ? (
        faceFeatures(face.art.shape, face.art.colors, HEAD.x, HEAD.y, HEAD.w, HEAD.h)
      ) : (
        faceFeatures('smile', {}, HEAD.x, HEAD.y, HEAD.w, HEAD.h)
      )}

      {/* gear in right hand */}
      {gear && gear.art && gearShape(gear.art.shape, gear.art.colors, ARM_R.x + ARM_R.w / 2, ARM_R.y + ARM_R.h * 0.72, 0.7)}

      {/* hats stacked on the head (wings already drawn behind) */}
      {hats
        .filter((h) => h.art && h.art.shape !== 'wings')
        .map((h, i) => (
          <g key={'hat' + i}>
            {hatShape(h.art.shape, h.art.colors, HEAD.x + HEAD.w / 2, HEAD.y + 2 - i * 14, HEAD.w / 100)}
          </g>
        ))}
    </svg>
  );
};

export default AvatarArt;
