import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Interactive 3D game previews (little rotating dioramas) for the games page
// rows and cards — replaces the flat thumbnail images.

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });

const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};

const buildDiorama = (thumbKey) => {
  const g = new THREE.Group();
  const key = String(thumbKey || '');
  const idMatch = key.match(/(\d+)/);
  const byId = idMatch ? { 101: 'sky', 102: 'brick', 103: 'canyon' }[idMatch[1]] : null;
  const k = (byId || key).toLowerCase();
  if (k.includes('brick')) {
    // Brick Busters: brick wall + paddle + ball
    const colors = ['#d33a2c', '#e8a33d', '#4b974b', '#0d69ac', '#923978'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 7; c++) {
        g.add(box(0.72, 0.38, 0.38, colors[r % colors.length], -2.4 + c * 0.8, 1.6 - r * 0.46, -0.6));
      }
    }
    g.add(box(1.9, 0.28, 0.6, '#232527', 0, -1.35, 1.2));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat('#f8f8f8'));
    ball.position.set(0.6, -0.55, 1.1);
    g.add(ball);
    g.add(box(6, 0.25, 3.2, '#2c2f33', 0, -1.85, 0));
    return g;
  }
  if (k.includes('crossy') || k.includes('canyon')) {
    // Crossy Canyon: canyon walls + road + cactus + car
    g.add(box(3.2, 1.6, 3.4, '#c7753f', -2.6, -0.8, 0));
    g.add(box(3.2, 1.6, 3.4, '#b5652f', 2.6, -0.8, 0));
    g.add(box(2.4, 0.14, 3.4, '#635f62', 0, -1.05, 0));
    for (let i = 0; i < 3; i++) {
      g.add(box(0.28, 0.04, 0.6, '#f8f8f8', 0, -0.96, -1.1 + i * 1.1));
    }
    g.add(box(1.15, 0.5, 0.6, '#d33a2c', -0.35, -0.72, 0.6));
    g.add(box(0.55, 0.28, 0.52, '#f8f8f8', -0.35, -0.35, 0.6));
    const cactus = new THREE.Group();
    cactus.add(box(0.24, 1.05, 0.24, '#4b974b', 0, 0, 0));
    cactus.add(box(0.5, 0.22, 0.22, '#4b974b', 0.32, 0.18, 0));
    cactus.add(box(0.22, 0.45, 0.22, '#4b974b', 0.5, 0.38, 0));
    cactus.position.set(1.35, -0.15, -1.0);
    g.add(cactus);
    return g;
  }
  // Sky Obby: floating islands + tower + flag
  const island = (x, y, z, s) => {
    const grp = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.02, 0.3, 10), mat('#4b974b'));
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.92, s * 0.35, s * 1.15, 10), mat('#8c5a34'));
    rock.position.y = -s * 0.7;
    grp.add(top, rock);
    grp.position.set(x, y, z);
    return grp;
  };
  g.add(island(-1.5, -0.9, 0.4, 1.15));
  g.add(island(1.35, -0.15, -0.5, 0.8));
  g.add(island(0.15, 1.05, 0.35, 0.55));
  g.add(box(0.62, 0.42, 0.62, '#e8a33d', -1.5, -0.52, 0.4));
  g.add(box(0.56, 0.42, 0.56, '#0d69ac', -1.05, -0.1, 0.15));
  g.add(box(0.5, 0.42, 0.5, '#d33a2c', -1.5, 0.32, 0.55));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), mat('#e2e2e2'));
  pole.position.set(0.15, 2.05, 0.35);
  g.add(pole);
  g.add(box(0.55, 0.34, 0.05, '#d33a2c', 0.48, 2.38, 0.35));
  return g;
};

const GamePreview3D = ({ thumbKey, height = 130, autoRotate = true }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const width = mount.clientWidth || 160;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      String(thumbKey || '').toLowerCase().includes('sky') ? '#bfe3f5' :
      String(thumbKey || '').toLowerCase().includes('canyon') ? '#f2d9b6' : '#dfe6ee'
    );
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 2.2, 6.2);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x99aabb, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 7, 5);
    scene.add(key);

    const group = buildDiorama(thumbKey);
    scene.add(group);

    let raf = 0;
    let dragging = false;
    let lastX = 0;
    let idle = true;
    const el = renderer.domElement;
    el.style.cursor = 'grab';
    const onDown = e => {
      dragging = true; idle = false;
      lastX = (e.touches && e.touches[0] ? e.touches[0] : e).clientX;
    };
    const onMove = e => {
      if (!dragging) return;
      const src = (e.touches && e.touches[0] ? e.touches[0] : e);
      group.rotation.y += (src.clientX - lastX) * 0.012;
      lastX = src.clientX;
    };
    const onUp = () => { dragging = false; setTimeout(() => { idle = true; }, 1500); };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      if (idle && autoRotate && !dragging) group.rotation.y += dt * 0.35;
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 160;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbKey, height, autoRotate]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height, borderRadius: 3, overflow: 'hidden' }}
    />
  );
};

export default GamePreview3D;
