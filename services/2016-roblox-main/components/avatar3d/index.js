import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getItemById, DEFAULT_AVATAR } from '../../lib/catalogItems';

// Interactive 3D R6 avatar viewer (three.js). Recreates the 2016 character
// preview: drag to rotate, scroll to zoom, slow auto-rotate when idle.

const HEAD_Y = 4.75;
const HEAD_TOP = 5.42;

const hex = (c, fallback) => new THREE.Color(/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : fallback);

const box = (w, h, d, color, x, y, z) => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04 }),
  );
  m.position.set(x, y, z);
  return m;
};

const faceTexture = (headColor, faceArt) => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = headColor;
  ctx.fillRect(0, 0, 256, 256);
  const ink = (faceArt && faceArt.colors && faceArt.colors.main) || '#222831';
  const shape = (faceArt && faceArt.shape) || 'smile';
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  if (shape === 'cool') {
    ctx.fillRect(38, 92, 74, 40);
    ctx.fillRect(144, 92, 74, 40);
    ctx.fillRect(108, 104, 40, 12);
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(84, 178);
    ctx.quadraticCurveTo(128, 202, 172, 178);
    ctx.stroke();
  } else if (shape === 'determined') {
    ctx.beginPath(); ctx.arc(82, 112, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(174, 112, 13, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(52, 82); ctx.lineTo(100, 96); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(204, 82); ctx.lineTo(156, 96); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(96, 182); ctx.lineTo(160, 182); ctx.stroke();
  } else if (shape === 'sleepy') {
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(62, 112); ctx.quadraticCurveTo(82, 130, 102, 112); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(154, 112); ctx.quadraticCurveTo(174, 130, 194, 112); ctx.stroke();
    ctx.beginPath(); ctx.arc(128, 182, 14, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(82, 112, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(174, 112, 13, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(76, 168);
    ctx.quadraticCurveTo(128, 204, 180, 168);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const addHat = (group, art, stackIndex) => {
  const y0 = HEAD_TOP + stackIndex * 0.34;
  const s = stackIndex === 0 ? 1 : 0.82;
  const main = hex(art.colors && art.colors.main, '#d62d20');
  const accent = hex(art.colors && art.colors.accent, '#ffffff');
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
  const put = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };
  switch (art.shape) {
    case 'cap':
      put(new THREE.SphereGeometry(0.55 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, y0, 0);
      put(new THREE.BoxGeometry(0.9 * s, 0.07, 0.5 * s), main, 0, y0 + 0.02, 0.55 * s);
      put(new THREE.BoxGeometry(1.02 * s, 0.06, 0.12), accent, 0, y0 + 0.05, 0.12 * s);
      break;
    case 'tophat':
      put(new THREE.CylinderGeometry(0.62 * s, 0.62 * s, 0.07, 20), main, 0, y0, 0);
      put(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.78 * s, 20), main, 0, y0 + 0.42 * s, 0);
      put(new THREE.CylinderGeometry(0.415 * s, 0.415 * s, 0.13, 20), accent, 0, y0 + 0.18 * s, 0);
      break;
    case 'crown':
      put(new THREE.CylinderGeometry(0.46 * s, 0.52 * s, 0.34, 18), main, 0, y0 + 0.17 * s, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        put(new THREE.ConeGeometry(0.09 * s, 0.24 * s, 8), main,
          Math.cos(a) * 0.45 * s, y0 + 0.42 * s, Math.sin(a) * 0.45 * s);
        put(new THREE.SphereGeometry(0.055 * s, 8, 8), accent,
          Math.cos(a) * 0.47 * s, y0 + 0.2 * s, Math.sin(a) * 0.47 * s);
      }
      break;
    case 'halo': {
      const ring = put(new THREE.TorusGeometry(0.5 * s, 0.075 * s, 10, 28), main, 0, y0 + 0.8 * s, 0, Math.PI / 2);
      ring.material = new THREE.MeshStandardMaterial({
        color: main, emissive: main, emissiveIntensity: 0.55, roughness: 0.4,
      });
      break;
    }
    case 'bandana':
      put(new THREE.CylinderGeometry(0.79 * s, 0.79 * s, 0.22, 20), main, 0, y0 - 0.32 * s, 0);
      put(new THREE.BoxGeometry(0.18, 0.16, 0.14), accent, 0.62 * s, y0 - 0.32 * s, 0.42 * s);
      put(new THREE.BoxGeometry(0.1, 0.34, 0.1), accent, 0.72 * s, y0 - 0.5 * s, 0.5 * s, 0, 0, 0.5);
      break;
    case 'party':
      put(new THREE.ConeGeometry(0.4 * s, 0.78 * s, 16), main, 0, y0 + 0.39 * s, 0);
      put(new THREE.CylinderGeometry(0.28 * s, 0.34 * s, 0.1, 16), accent, 0, y0 + 0.22 * s, 0);
      put(new THREE.SphereGeometry(0.15 * s, 10, 10), accent, 0, y0 + 0.82 * s, 0);
      break;
    case 'antenna':
      put(new THREE.SphereGeometry(0.52 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, y0, 0);
      put(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), main, 0, y0 + 0.48 * s, 0);
      put(new THREE.SphereGeometry(0.13 * s, 10, 10), accent, 0, y0 + 0.8 * s, 0);
      break;
    case 'wings':
      put(new THREE.BoxGeometry(1.05, 1.35, 0.14), main, -0.95, 3.7, -0.7, 0, 0.35, 0.55);
      put(new THREE.BoxGeometry(1.05, 1.35, 0.14), main, 0.95, 3.7, -0.7, 0, -0.35, -0.55);
      put(new THREE.BoxGeometry(0.7, 0.9, 0.1), accent, -1.05, 3.6, -0.82, 0, 0.35, 0.55);
      put(new THREE.BoxGeometry(0.7, 0.9, 0.1), accent, 1.05, 3.6, -0.82, 0, -0.35, -0.55);
      break;
    default:
      break;
  }
};

const addGear = (group, art) => {
  const main = hex(art.colors && art.colors.main, '#9aa5b1');
  const accent = hex(art.colors && art.colors.accent, '#6b4f2a');
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.12 });
  const put = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
  };
  if (art.shape === 'sword') {
    put(new THREE.BoxGeometry(0.09, 1.55, 0.26), main, 1.78, 2.85, 0.32, -0.45);
    put(new THREE.BoxGeometry(0.36, 0.08, 0.12), accent, 1.78, 2.12, 0.32, -0.45);
    put(new THREE.BoxGeometry(0.1, 0.42, 0.1), accent, 1.78, 1.92, 0.32, -0.45);
  } else if (art.shape === 'boombox') {
    put(new THREE.BoxGeometry(0.8, 0.5, 0.3), main, 1.85, 2.25, 0.35);
    put(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 14), accent, 1.62, 2.25, 0.52, Math.PI / 2);
    put(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 14), accent, 2.08, 2.25, 0.52, Math.PI / 2);
  } else if (art.shape === 'coil') {
    for (let i = 0; i < 3; i++) {
      put(new THREE.TorusGeometry(0.24, 0.055, 8, 20), i % 2 ? accent : main,
        1.72, 1.75 + i * 0.24, 0.28, Math.PI / 2 + i * 0.25);
    }
  }
};

const buildCharacter = (config) => {
  const cfg = config && config.bodyColors ? config : DEFAULT_AVATAR;
  const colors = { ...DEFAULT_AVATAR.bodyColors, ...(cfg.bodyColors || {}) };
  const group = new THREE.Group();

  const face = cfg.faceId ? getItemById(cfg.faceId) : null;
  const shirt = cfg.shirtId ? getItemById(cfg.shirtId) : null;
  const pants = cfg.pantsId ? getItemById(cfg.pantsId) : null;
  const gear = cfg.gearId ? getItemById(cfg.gearId) : null;
  const hats = (cfg.hatIds || []).map(getItemById).filter(Boolean);

  const shirtC = (shirt && shirt.art && shirt.art.colors) || {};
  const pantsC = (pants && pants.art && pants.art.colors) || {};

  // legs (pants color or body color)
  group.add(box(0.95, 2, 1, hex(pantsC.main, colors.leftLeg), -0.5, 1, 0));
  group.add(box(0.95, 2, 1, hex(pantsC.main, colors.rightLeg), 0.5, 1, 0));

  // arms: sleeve + skin halves
  const sleeveL = shirtC.sleeve ? hex(shirtC.sleeve) : hex(colors.leftArm);
  const sleeveR = shirtC.sleeve ? hex(shirtC.sleeve) : hex(colors.rightArm);
  group.add(box(0.95, 1, 1, sleeveL, -1.475, 3.5, 0));
  group.add(box(0.95, 1, 1, hex(colors.leftArm), -1.475, 2.5, 0));
  group.add(box(0.95, 1, 1, sleeveR, 1.475, 3.5, 0));
  group.add(box(0.95, 1, 1, hex(colors.rightArm), 1.475, 2.5, 0));

  // torso
  group.add(box(2, 2, 1, hex(shirtC.torso, colors.torso), 0, 3, 0));

  // head with face texture on the front
  const headColor = hex(colors.head);
  const headMats = [0, 1, 2, 3, 5].map(() =>
    new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.72, metalness: 0.04 }),
  );
  headMats.splice(4, 0, new THREE.MeshStandardMaterial({
    map: faceTexture('#' + headColor.getHexString(), face && face.art),
    roughness: 0.72,
    metalness: 0.04,
  }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.35, 1.35), headMats);
  head.position.set(0, HEAD_Y, 0);
  group.add(head);

  hats.forEach((h, i) => {
    if (h.art && h.art.shape === 'wings') addHat(group, h.art, 0);
    else addHat(group, h.art, hats.filter((x, j) => j < i && x.art && x.art.shape !== 'wings').length);
  });

  if (gear && gear.art) addGear(group, gear.art);

  return group;
};

const Avatar3D = ({ config, userId, height = 420, autoRotate = true }) => {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const width = mount.clientWidth || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 3.1, 9.2);
    camera.lookAt(0, 2.85, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(4, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.4);
    fill.position.set(-5, 4, -4);
    scene.add(fill);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.13 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    scene.add(shadow);

    const state = {
      scene, camera, renderer, char: null, raf: 0,
      dragging: false, lastX: 0, lastY: 0, vel: 0, idle: true,
    };
    stateRef.current = state;

    const rebuild = () => {
      if (state.char) {
        scene.remove(state.char);
        state.char.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      }
      state.char = buildCharacter(configRef.current);
      scene.add(state.char);
    };
    rebuild();
    state.rebuild = rebuild;

    const onDown = (e) => {
      state.dragging = true;
      state.idle = false;
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      state.lastX = src.clientX;
      state.lastY = src.clientY;
    };
    const onMove = (e) => {
      if (!state.dragging) return;
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      const dx = src.clientX - state.lastX;
      const dy = src.clientY - state.lastY;
      state.lastX = src.clientX;
      state.lastY = src.clientY;
      if (state.char) {
        state.char.rotation.y += dx * 0.011;
        state.char.rotation.x = Math.max(-0.3, Math.min(0.3, state.char.rotation.x + dy * 0.005));
      }
    };
    const onUp = () => {
      state.dragging = false;
      setTimeout(() => { state.idle = true; }, 1800);
    };
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(5.5, Math.min(13, camera.position.z + e.deltaY * 0.012));
    };

    const el = renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    const clock = new THREE.Clock();
    const loop = () => {
      state.raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      if (state.char && state.idle && autoRotate && !state.dragging) {
        state.char.rotation.y += dt * 0.28;
      }
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 320;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      el.removeEventListener('wheel', onWheel);
      if (state.char) {
        state.char.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, autoRotate]);

  // rebuild the character when the config changes
  useEffect(() => {
    const state = stateRef.current;
    if (state && state.rebuild) state.rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config || null)]);

  // fetch the config from the API when only a userId is given
  useEffect(() => {
    if (!userId || config) return;
    let cancelled = false;
    fetch('/api/web/users/' + userId + '/avatar')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && d.data && d.data.config) {
          configRef.current = d.data.config;
          const state = stateRef.current;
          if (state && state.rebuild) state.rebuild();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height,
        borderRadius: 4,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #cfe3f2 0%, #eef4f9 70%, #dfe9f0 100%)',
      }}
    />
  );
};

export default Avatar3D;
