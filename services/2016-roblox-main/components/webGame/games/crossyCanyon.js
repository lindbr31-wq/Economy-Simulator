import * as THREE from 'three';

// Crossy Canyon — 3D. Hop across the road and river, dodge cars, ride logs.

const W = 800;
const H = 450;
const TILE = 1.6;

const SKIN = 0xf5cd30;
const SHIRT = 0xd33a2c;
const PANTS = 0x232527;

const makeCharacter = () => {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const box = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  box(0.42, 0.5, 0.42, PANTS, -0.22, 0.25, 0);
  box(0.42, 0.5, 0.42, PANTS, 0.22, 0.25, 0);
  box(0.9, 0.55, 0.5, SHIRT, 0, 0.78, 0);
  box(0.28, 0.55, 0.42, SHIRT, -0.62, 0.78, 0);
  box(0.28, 0.55, 0.42, SHIRT, 0.62, 0.78, 0);
  box(0.62, 0.55, 0.55, SKIN, 0, 1.35, 0);
  return g;
};

export default function createCrossyCanyon(api, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setClearColor(0xf2d9b6, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2d9b6, 26, 60);

  const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaa8866, 1.05));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(12, 20, 8);
  scene.add(sun);

  const mat = (c, opts = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...opts });
  const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));

  let player, playerTile, hopT, hopFrom, hopTo, dead;
  let rows = []; // {type:'safe'|'road'|'river', mesh, obstacles: [{mesh, x, speed, dir}]}
  let score, best, lives;
  let camRow = 0;

  const buildRows = () => {
    rows.forEach(r => {
      scene.remove(r.mesh);
      r.obstacles.forEach(o => scene.remove(o.mesh));
    });
    rows = [];
    for (let i = -2; i < 40; i++) {
      const type = i < 3 ? 'safe' : (i % 7 === 5 ? 'river' : i % 3 === 1 ? 'road' : 'safe');
      const color = type === 'road' ? 0x635f62 : type === 'river' ? 0x2966c0 : 0xc7753f;
      const mesh = box(16, type === 'safe' ? 0.5 : 0.32, TILE, color);
      mesh.position.set(0, type === 'safe' ? -0.25 : -0.16, i * TILE);
      scene.add(mesh);
      const row = { type, mesh, obstacles: [] };
      if (type === 'road') {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let c = 0; c < count; c++) {
          const car = box(1.5, 0.75, 0.95, [0xd33a2c, 0x0d69ac, 0xf8f8f8, 0xe8a33d][Math.floor(Math.random() * 4)]);
          const x = -8 + Math.random() * 16;
          car.position.set(x, 0.42, i * TILE);
          scene.add(car);
          const cab = box(0.9, 0.4, 0.8, 0x232527);
          cab.position.set(x, 0.95, i * TILE);
          scene.add(cab);
          row.obstacles.push({ mesh: car, cab, x, speed: 3.2 + Math.random() * 3.4 + i * 0.06, dir: Math.random() > 0.5 ? 1 : -1 });
        }
      } else if (type === 'river') {
        const count = 2;
        for (let c = 0; c < count; c++) {
          const log = box(2.6, 0.42, 1.1, 0x8c5a34);
          const x = -8 + c * 8 + Math.random() * 3;
          log.position.set(x, 0.18, i * TILE);
          scene.add(log);
          row.obstacles.push({ mesh: log, cab: null, x, speed: 2.2 + Math.random() * 1.8, dir: c % 2 ? 1 : -1 });
        }
      }
      rows.push(row);
    }
    // canyon walls
    for (const side of [-1, 1]) {
      const wall = box(2.4, 2.4, 90, 0xb5652f);
      wall.position.set(side * 9.2, 0.6, 30);
      scene.add(wall);
      rows.push({ type: 'wall', mesh: wall, obstacles: [] });
    }
    // cacti on safe rows
    for (let i = 6; i < 38; i += 6) {
      const cactus = new THREE.Group();
      const c1 = box(0.35, 1.5, 0.35, 0x4b974b);
      const c2 = box(0.8, 0.3, 0.3, 0x4b974b);
      c2.position.set(0.55, 0.35, 0);
      const c3 = box(0.3, 0.7, 0.3, 0x4b974b);
      c3.position.set(0.85, 0.65, 0);
      cactus.add(c1, c2, c3);
      cactus.position.set((i % 2 ? -1 : 1) * (4 + Math.random() * 2), 0.75, i * TILE);
      scene.add(cactus);
    }
  };

  const reset = () => {
    buildRows();
    player = makeCharacter();
    scene.add(player);
    playerTile = { x: 0, z: 0 };
    hopT = 0;
    dead = false;
    score = 0;
    lives = 1;
    camRow = 0;
    player.position.set(0, 0, 0);
    api.setScore(0);
    api.setLives(1);
  };

  const die = () => {
    if (dead) return;
    dead = true;
    api.gameOver();
  };

  const hop = (dx, dz) => {
    if (hopT > 0 || dead) return;
    const nx = Math.max(-4, Math.min(4, playerTile.x + dx));
    const nz = playerTile.z + dz;
    if (nz < 0) return;
    hopFrom = new THREE.Vector3(player.position.x, 0, player.position.z);
    hopTo = new THREE.Vector3(nx * TILE, 0, nz * TILE);
    playerTile = { x: nx, z: nz };
    hopT = 0.18;
    if (dz > 0 && nz > score) {
      score = nz;
      api.setScore(score);
    }
  };

  const update = (dt, input) => {
    dt = Math.min(dt, 0.05);

    // hop input
    if (input.pressed.left) hop(-1, 0);
    else if (input.pressed.right) hop(1, 0);
    else if (input.pressed.up) hop(0, 1);
    else if (input.pressed.down) hop(0, -1);
    if (input.tapped && input.tapped.y !== undefined) {
      // tap: up half = forward, left/right thirds = sides
      if (input.tapped.x < W / 3) hop(-1, 0);
      else if (input.tapped.x > (W / 3) * 2) hop(1, 0);
      else hop(0, 1);
    }

    // hop animation
    if (hopT > 0) {
      hopT -= dt;
      const t = 1 - Math.max(0, hopT) / 0.18;
      player.position.x = hopFrom.x + (hopTo.x - hopFrom.x) * t;
      player.position.z = hopFrom.z + (hopTo.z - hopFrom.z) * t;
      player.position.y = Math.sin(t * Math.PI) * 0.9;
    } else {
      player.position.y = 0;
    }

    // obstacles
    const pz = player.position.z;
    for (const row of rows) {
      if (row.type !== 'road' && row.type !== 'river') continue;
      const onRow = Math.abs(row.mesh.position.z - pz) < TILE * 0.55;
      for (const o of row.obstacles) {
        o.x += o.speed * o.dir * dt;
        if (o.x > 10) o.x = -10;
        if (o.x < -10) o.x = 10;
        o.mesh.position.x = o.x;
        if (o.cab) o.cab.position.x = o.x;
        if (onRow && Math.abs(o.x - player.position.x) < 1.25 && hopT <= 0.06) {
          if (row.type === 'road') die();
          // river: only safe on a log
        }
      }
      if (onRow && row.type === 'river' && hopT <= 0.06) {
        const onLog = row.obstacles.some(o => Math.abs(o.x - player.position.x) < 1.5);
        if (!onLog) die();
      }
    }

    // camera follows behind the player
    camRow += (player.position.z - camRow) * 0.08;
    camera.position.set(0.2, 7.2, camRow - 7.5);
    camera.lookAt(0, 0.8, camRow + 3.5);

    renderer.render(scene, camera);
  };

  reset();
  return { reset, update, W, H };
}
