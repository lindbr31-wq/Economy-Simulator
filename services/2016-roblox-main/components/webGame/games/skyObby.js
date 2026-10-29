import * as THREE from 'three';

// Sky Obby: Tower Trials — 3D. Run and jump up floating platforms,
// collect coins, reach the flags, do not fall. (R6 blocky character!)

const W = 800;
const H = 450;
const GRAVITY = -22;
const MOVE_SPEED = 6.2;
const JUMP_V = 10.2;

const SKIN = 0xf5cd30;
const SHIRT = 0x0d69ac;
const PANTS = 0x4b974b;

const makeCharacter = () => {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const box = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  box(0.95, 1, 1, PANTS, -0.5, 0.5, 0); // legs
  box(0.95, 1, 1, PANTS, 0.5, 0.5, 0);
  box(2, 1, 1, SHIRT, 0, 1.5, 0); // torso
  box(0.95, 1, 1, SHIRT, -1.475, 1.5, 0); // arms
  box(0.95, 1, 1, SHIRT, 1.475, 1.5, 0);
  box(1.5, 1.2, 1.2, SKIN, 0, 2.6, 0); // head
  return g;
};

export default function createSkyObby(api, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setClearColor(0xbfe3f5, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfe3f5, 30, 90);

  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(10, 30, 15);
  scene.add(sun);

  // world state
  let platforms = []; // {mesh, x, y, z, w, d, kind:'static'|'move'|'vanish', t, baseX}
  let coins = []; // {mesh, x, y, z, taken}
  let player, playerPos, vel, onGround, lives, score, coinsGot, level, deadT, won;
  let checkpoint = { x: 0, y: 2.2, z: 0 };
  let flagMesh = null;

  const clearWorld = () => {
    platforms.forEach(p => scene.remove(p.mesh));
    coins.forEach(c => scene.remove(c.mesh));
    if (flagMesh) scene.remove(flagMesh);
    platforms = [];
    coins = [];
    flagMesh = null;
  };

  const addPlatform = (x, y, z, w, d, kind = 'static', color = 0x8c5a34) => {
    const geo = new THREE.BoxGeometry(w, 1, d);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    // grass cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), new THREE.MeshStandardMaterial({ color: 0x4b974b }));
    cap.position.set(x, y + 0.59, z);
    scene.add(cap);
    platforms.push({ mesh, cap, x, y, z, w, d, kind, t: Math.random() * 6, baseX: x, gone: 0 });
  };

  const addCoin = (x, y, z) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0x7a5c12, metalness: 0.6, roughness: 0.35 }),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    coins.push({ mesh, x, y, z, taken: false });
  };

  const buildLevel = () => {
    clearWorld();
    addPlatform(0, -0.5, 0, 9, 9, 'static'); // start island
    let y = 0;
    let x = 0;
    let z = 0;
    const rng = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 22; i++) {
      y += rng(1.6, 2.6);
      x += rng(-3.2, 3.2);
      z += rng(-1.6, 1.6);
      x = Math.max(-8, Math.min(8, x));
      z = Math.max(-5, Math.min(5, z));
      const kind = i > 4 && i % 4 === 0 ? 'move' : i > 6 && i % 5 === 0 ? 'vanish' : 'static';
      addPlatform(x, y, z, rng(2.6, 4.2), rng(2.6, 4.2), kind, kind === 'vanish' ? 0xc7753f : kind === 'move' ? 0x0d69ac : 0x8c5a34);
      if (i % 2 === 0) addCoin(x, y + 1.4, z);
      if (i % 7 === 3) addCoin(x + 1.2, y + 1.4, z);
    }
    // finish flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xe2e2e2 }));
    pole.position.set(x, y + 2.2, z);
    scene.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.08), new THREE.MeshStandardMaterial({ color: 0xd33a2c }));
    flag.position.set(x + 0.85, y + 3.3, z);
    scene.add(flag);
    flagMesh = flag;
  };

  player = makeCharacter();
  scene.add(player);

  const reset = () => {
    buildLevel();
    playerPos = new THREE.Vector3(0, 1.2, 0);
    vel = new THREE.Vector3();
    onGround = false;
    lives = 3;
    score = 0;
    coinsGot = 0;
    level = 1;
    deadT = 0;
    won = false;
    checkpoint = { x: 0, y: 1.2, z: 0 };
    api.setLives(lives);
    api.setScore(0);
    player.visible = true;
  };

  const die = () => {
    lives -= 1;
    api.setLives(Math.max(0, lives));
    if (lives <= 0) {
      api.gameOver();
      return;
    }
    deadT = 0.8;
    playerPos.set(checkpoint.x, checkpoint.y, checkpoint.z);
    vel.set(0, 0, 0);
  };

  const update = (dt, input) => {
    dt = Math.min(dt, 0.05);

    // moving / vanishing platforms
    for (const p of platforms) {
      p.t += dt;
      if (p.kind === 'move') {
        const nx = p.baseX + Math.sin(p.t * 1.1) * 1.8;
        const dx = nx - p.x;
        p.x = nx;
        p.mesh.position.x = nx;
        if (p.cap) p.cap.position.x = nx;
        // carry player
        if (onGround && Math.abs(playerPos.x - p.x) < p.w / 2 + 0.6 && Math.abs(playerPos.z - p.z) < p.d / 2 + 0.6 && Math.abs(playerPos.y - (p.y + 1.5)) < 1.2) {
          playerPos.x += dx;
        }
      } else if (p.kind === 'vanish') {
        if (p.gone > 0) {
          p.gone -= dt;
          const show = p.gone <= 0;
          p.mesh.visible = show;
          if (p.cap) p.cap.visible = show;
        }
      }
    }

    if (deadT > 0) {
      deadT -= dt;
    } else {
      // movement
      const dir = new THREE.Vector3();
      if (input.held.left) dir.x -= 1;
      if (input.held.right) dir.x += 1;
      if (input.held.up) dir.z -= 1;
      if (input.held.down) dir.z += 1;
      if (dir.lengthSq() > 0) {
        dir.normalize();
        playerPos.x += dir.x * MOVE_SPEED * dt;
        playerPos.z += dir.z * MOVE_SPEED * dt;
        player.rotation.y = Math.atan2(dir.x, dir.z);
      }
      // jump + gravity
      if ((input.pressed.jump || input.pressed.up && !onGround === false) && onGround) {
        vel.y = JUMP_V;
        onGround = false;
      }
      vel.y += GRAVITY * dt;
      playerPos.y += vel.y * dt;

      // collisions with platforms (AABB, top landing)
      onGround = false;
      for (const p of platforms) {
        if (p.kind === 'vanish' && p.mesh.visible === false) continue;
        const halfW = p.w / 2 + 0.55;
        const halfD = p.d / 2 + 0.55;
        if (Math.abs(playerPos.x - p.x) < halfW && Math.abs(playerPos.z - p.z) < halfD) {
          const top = p.y + 1.0;
          if (playerPos.y <= top + 0.1 && playerPos.y > top - 1.2 && vel.y <= 0) {
            playerPos.y = top + 0.02;
            vel.y = 0;
            onGround = true;
            if (p.kind === 'vanish' && p.gone <= 0) p.gone = 1.2;
          }
        }
      }

      // coins
      for (const c of coins) {
        if (c.taken) continue;
        const d = Math.abs(playerPos.x - c.x) + Math.abs(playerPos.y - c.y) + Math.abs(playerPos.z - c.z);
        if (d < 1.6) {
          c.taken = true;
          scene.remove(c.mesh);
          coinsGot += 1;
          score += 10;
          api.setScore(score);
        }
      }

      // fell?
      if (playerPos.y < -12) die();
    }

    player.position.copy(playerPos);

    // flag reach
    if (flagMesh && !won) {
      const d = Math.abs(playerPos.x - flagMesh.position.x) + Math.abs(playerPos.z - flagMesh.position.z);
      if (d < 2.4 && playerPos.y > flagMesh.position.y - 4) {
        won = true;
        score += 100;
        api.setScore(score);
        api.gameOver();
      }
    }

    // camera: side-follow
    camera.position.lerp(new THREE.Vector3(playerPos.x * 0.55, playerPos.y + 4.2, playerPos.z + 11.5), 0.09);
    camera.lookAt(playerPos.x * 0.8, playerPos.y + 1.2, playerPos.z);

    renderer.render(scene, camera);
  };

  reset();
  return { reset, update, W, H };
}
