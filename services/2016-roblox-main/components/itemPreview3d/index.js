import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Interactive 3D item preview: rotating turntable with the item built from
// its art spec (same shapes as the SVG art components). Used everywhere item
// images appear (catalog tiles, item pages, wardrobe, profile wearing).

const artCache = {};

export const getItemArt = (id) => {
  if (artCache[id]) return Promise.resolve(artCache[id]);
  return fetch('/api/web/catalog')
    .then(r => r.json())
    .then(d => {
      const rows = (d.data || []);
      rows.forEach(v => { artCache[v.id] = v; });
      // games also render as previews on item-like surfaces
      return artCache[id] || null;
    })
    .catch(() => null);
};

const hex = (c, fallback) => new THREE.Color(/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : fallback);

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05, ...opts });

const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};

const faceTexture = (headColor, art) => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = headColor;
  ctx.fillRect(0, 0, 256, 256);
  const ink = (art && art.colors && art.colors.main) || '#222831';
  const shape = (art && art.shape) || 'smile';
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  if (shape === 'cool') {
    ctx.fillRect(38, 92, 74, 40);
    ctx.fillRect(144, 92, 74, 40);
    ctx.fillRect(108, 104, 40, 12);
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(84, 178); ctx.quadraticCurveTo(128, 202, 172, 178); ctx.stroke();
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
    ctx.beginPath(); ctx.moveTo(76, 168); ctx.quadraticCurveTo(128, 204, 180, 168); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const buildHatMeshes = (art) => {
  const g = new THREE.Group();
  const main = hex(art.colors && art.colors.main, '#d62d20');
  const accent = hex(art.colors && art.colors.accent, '#ffffff');
  const put = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, extraMat = null) => {
    const m = new THREE.Mesh(geo, extraMat || mat(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  switch (art.shape) {
    case 'cap':
      put(new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0, 0);
      put(new THREE.BoxGeometry(0.9, 0.07, 0.5), main, 0, 0.02, 0.55);
      put(new THREE.BoxGeometry(1.02, 0.06, 0.12), accent, 0, 0.05, 0.12);
      break;
    case 'tophat':
      put(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 20), main, 0, 0, 0);
      put(new THREE.CylinderGeometry(0.4, 0.4, 0.78, 20), main, 0, 0.42, 0);
      put(new THREE.CylinderGeometry(0.415, 0.415, 0.13, 20), accent, 0, 0.18, 0);
      break;
    case 'crown':
      put(new THREE.CylinderGeometry(0.46, 0.52, 0.34, 18), main, 0, 0.17, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        put(new THREE.ConeGeometry(0.09, 0.24, 8), main, Math.cos(a) * 0.45, 0.42, Math.sin(a) * 0.45);
        put(new THREE.SphereGeometry(0.055, 8, 8), accent, Math.cos(a) * 0.47, 0.2, Math.sin(a) * 0.47);
      }
      break;
    case 'halo': {
      const ring = put(new THREE.TorusGeometry(0.5, 0.075, 10, 28), main, 0, 0.55, 0, Math.PI / 2);
      ring.material = mat(main, { emissive: main, emissiveIntensity: 0.55, roughness: 0.4 });
      break;
    }
    case 'bandana':
      put(new THREE.CylinderGeometry(0.72, 0.72, 0.22, 20), main, 0, 0, 0);
      put(new THREE.BoxGeometry(0.18, 0.16, 0.14), accent, 0.56, 0, 0.38);
      put(new THREE.BoxGeometry(0.1, 0.34, 0.1), accent, 0.66, -0.18, 0.46, 0, 0, 0.5);
      break;
    case 'party':
      put(new THREE.ConeGeometry(0.4, 0.78, 16), main, 0, 0.39, 0);
      put(new THREE.CylinderGeometry(0.28, 0.34, 0.1, 16), accent, 0, 0.22, 0);
      put(new THREE.SphereGeometry(0.15, 10, 10), accent, 0, 0.82, 0);
      break;
    case 'antenna':
      put(new THREE.SphereGeometry(0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0, 0);
      put(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), main, 0, 0.48, 0);
      put(new THREE.SphereGeometry(0.13, 10, 10), accent, 0, 0.8, 0);
      break;
    case 'wings':
      put(new THREE.BoxGeometry(1.05, 1.35, 0.14), main, -0.55, 0.2, -0.35, 0, 0.35, 0.55);
      put(new THREE.BoxGeometry(1.05, 1.35, 0.14), main, 0.55, 0.2, -0.35, 0, -0.35, -0.55);
      put(new THREE.BoxGeometry(0.7, 0.9, 0.1), accent, -0.65, 0.1, -0.47, 0, 0.35, 0.55);
      put(new THREE.BoxGeometry(0.7, 0.9, 0.1), accent, 0.65, 0.1, -0.47, 0, -0.35, -0.55);
      break;
    default:
      put(new THREE.SphereGeometry(0.55, 16, 12), main, 0, 0.1, 0);
  }
  return g;
};

const buildGearMeshes = (art) => {
  const g = new THREE.Group();
  const main = hex(art.colors && art.colors.main, '#9aa5b1');
  const accent = hex(art.colors && art.colors.accent, '#6b4f2a');
  const put = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat(color, { roughness: 0.65, metalness: 0.12 }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
  };
  if (art.shape === 'sword') {
    put(new THREE.BoxGeometry(0.14, 1.8, 0.38), main, 0, 0.45, 0);
    put(new THREE.ConeGeometry(0.21, 0.42, 4), main, 0, 1.55, 0, 0, Math.PI / 4, 0);
    put(new THREE.BoxGeometry(0.62, 0.12, 0.18), accent, 0, -0.52, 0);
    put(new THREE.BoxGeometry(0.16, 0.55, 0.16), accent, 0, -0.86, 0);
    g.rotation.z = -0.35;
  } else if (art.shape === 'boombox') {
    put(new THREE.BoxGeometry(1.5, 0.95, 0.55), main, 0, 0, 0);
    put(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 18), accent, -0.42, 0, 0.31, Math.PI / 2);
    put(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 18), accent, 0.42, 0, 0.31, Math.PI / 2);
    put(new THREE.BoxGeometry(0.5, 0.14, 0.1), accent, 0, 0.28, 0.31);
    put(new THREE.BoxGeometry(0.9, 0.08, 0.08), main, 0, 0.62, 0);
  } else if (art.shape === 'coil') {
    for (let i = 0; i < 3; i++) {
      put(new THREE.TorusGeometry(0.5, 0.11, 10, 24), i % 2 ? accent : main, 0, -0.5 + i * 0.5, 0, Math.PI / 2 + i * 0.22);
    }
    put(new THREE.SphereGeometry(0.22, 12, 12), accent, 0, 1.05, 0);
  } else {
    put(new THREE.BoxGeometry(0.9, 0.9, 0.9), main, 0, 0, 0);
  }
  return g;
};

const buildItemGroup = (item) => {
  const g = new THREE.Group();
  const art = (item && item.art) || {};
  const category = item && item.category;
  if (category === 'hats') {
    const hat = buildHatMeshes(art);
    hat.position.y = 0.15;
    g.add(hat);
  } else if (category === 'faces') {
    const headColor = hex(art.colors && art.colors.head, '#f5cd30');
    const tex = faceTexture('#' + headColor.getHexString(), art);
    const mats = [0, 1, 2, 3, 5].map(() => mat(headColor));
    mats.splice(4, 0, mat(headColor, { map: tex }));
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.35, 1.35), mats);
    g.add(head);
  } else if (category === 'shirts') {
    const torso = hex(art.colors && art.colors.torso, '#0d69ac');
    const sleeve = hex(art.colors && art.colors.sleeve, '#f5cd30');
    g.add(box(2, 2, 1, torso));
    g.add(box(0.8, 2, 1, sleeve, -1.5, 0, 0));
    g.add(box(0.8, 2, 1, sleeve, 1.5, 0, 0));
  } else if (category === 'pants') {
    const main = hex(art.colors && art.colors.main, '#3b7599');
    g.add(box(0.95, 2, 1, main, -0.52, -0.6, 0));
    g.add(box(0.95, 2, 1, main, 0.52, -0.6, 0));
    g.add(box(2, 0.55, 1, main, 0, 0.95, 0));
  } else if (category === 'gear') {
    const gear = buildGearMeshes(art);
    g.add(gear);
  } else {
    g.add(box(1.2, 1.2, 1.2, hex(art.colors && art.colors.main, '#d62d20')));
  }
  return g;
};

const ItemPreview3D = ({ item, id, height = 150, autoRotate = true }) => {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const resolvedRef = useRef(item || null);
  const [resolved, setResolved] = useState(item || null);
  resolvedRef.current = resolved || resolvedRef.current;

  useEffect(() => {
    if (item || !id) return;
    let cancelled = false;
    getItemArt(id).then(art => {
      if (!cancelled && art) setResolved(art);
    });
    return () => { cancelled = true; };
  }, [id, item]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const width = mount.clientWidth || 150;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    camera.position.set(0, 0.7, 4.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.4);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const state = { scene, camera, renderer, group: null, raf: 0, dragging: false, lastX: 0, idle: true };
    stateRef.current = state;

    const rebuild = () => {
      if (state.group) {
        scene.remove(state.group);
        state.group.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
          }
        });
      }
      state.group = buildItemGroup(resolvedRef.current || { art: {}, category: 'hats' });
      scene.add(state.group);
    };
    rebuild();
    state.rebuild = rebuild;

    const el = renderer.domElement;
    el.style.cursor = 'grab';
    const onDown = e => {
      state.dragging = true;
      state.idle = false;
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      state.lastX = src.clientX;
    };
    const onMove = e => {
      if (!state.dragging || !state.group) return;
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      state.group.rotation.y += (src.clientX - state.lastX) * 0.014;
      state.lastX = src.clientX;
    };
    const onUp = () => {
      state.dragging = false;
      setTimeout(() => { state.idle = true; }, 1500);
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    const clock = new THREE.Clock();
    const loop = () => {
      state.raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      if (state.group && state.idle && autoRotate && !state.dragging) {
        state.group.rotation.y += dt * 0.6;
      }
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 150;
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
      if (state.group) {
        state.group.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
          }
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, autoRotate]);

  useEffect(() => {
    const state = stateRef.current;
    if (state && state.rebuild) state.rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(resolved || null)]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height,
        borderRadius: 4,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 35%, #eef4f9 0%, #d7e4ee 100%)',
      }}
    />
  );
};

export default ItemPreview3D;
