import * as THREE from 'three';

// Brick Busters — 3D. Keep the ball in play, smash the brick wall.

const W = 800;
const H = 450;

const BRICK_COLORS = [0xd33a2c, 0xe8a33d, 0x4b974b, 0x0d69ac, 0x923978];

export default function createBrickBusters(api, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setClearColor(0x171a21, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  camera.position.set(0, 2.2, 13.5);
  camera.lookAt(0, 1.2, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 10, 8);
  scene.add(key);

  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1 });
  const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));

  // arena floor + back wall
  const floor = box(16, 0.3, 8, 0x2c2f33);
  floor.position.set(0, -1.9, 1);
  scene.add(floor);
  const back = box(16, 9, 0.3, 0x22252a);
  back.position.set(0, 2.4, -3.6);
  scene.add(back);

  const paddle = box(2.6, 0.42, 1.1, 0x2966c0);
  paddle.position.set(0, -1.45, 4.6);
  scene.add(paddle);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), mat(0xf8f8f8));
  scene.add(ball);

  let bricks = []; // {mesh, alive}
  let paddleX, ballPos, ballVel, lives, score, level, stuck, wideT;
  let powerup = null; // {mesh, y}

  const buildWall = () => {
    bricks.forEach(b => scene.remove(b.mesh));
    bricks = [];
    const rows = Math.min(4 + level, 7);
    const cols = 9;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const m = box(1.42, 0.55, 0.6, BRICK_COLORS[r % BRICK_COLORS.length]);
        m.position.set(-6.4 + c * 1.6, 5.6 - r * 0.78, -1.6);
        scene.add(m);
        bricks.push({ mesh: m, alive: true });
      }
    }
  };

  const resetBall = () => {
    ballPos.set(paddleX, -0.85, 4.6);
    ballVel.set(0, 0, 0);
    stuck = true;
  };

  const reset = () => {
    paddleX = 0;
    ballPos = new THREE.Vector3();
    ballVel = new THREE.Vector3();
    lives = 3;
    score = 0;
    level = 1;
    wideT = 0;
    powerup = null;
    buildWall();
    resetBall();
    api.setLives(lives);
    api.setScore(0);
  };

  const launch = () => {
    if (!stuck) return;
    stuck = false;
    const angle = (Math.random() * 0.6 - 0.3) + Math.PI / 2 * -1;
    const speed = 8 + level * 0.8;
    ballVel.set(Math.sin(angle) * speed * 0.55, Math.abs(Math.cos(angle)) * speed * -1, 0);
  };

  const update = (dt, input) => {
    dt = Math.min(dt, 0.05);

    // paddle control
    if (input.held.left) paddleX -= 11 * dt;
    if (input.held.right) paddleX += 11 * dt;
    if (input.pointer.x !== null && input.pointer.x !== undefined) {
      const target = ((input.pointer.x / W) * 2 - 1) * 7.2;
      paddleX += (target - paddleX) * 0.35;
    }
    paddleX = Math.max(-6.6, Math.min(6.6, paddleX));
    paddle.position.x = paddleX;
    paddle.scale.x = wideT > 0 ? 1.7 : 1;

    if (wideT > 0) wideT -= dt;

    if (input.pressed.jump || input.pressed.pointer) launch();

    if (stuck) {
      ballPos.set(paddleX, -0.85, 4.35);
    } else {
      ballPos.x += ballVel.x * dt;
      ballPos.y += ballVel.y * dt;

      // walls
      if (ballPos.x < -7.6) { ballPos.x = -7.6; ballVel.x = Math.abs(ballVel.x); }
      if (ballPos.x > 7.6) { ballPos.x = 7.6; ballVel.x = -Math.abs(ballVel.x); }
      if (ballPos.y > 8.2) { ballPos.y = 8.2; ballVel.y = -Math.abs(ballVel.y); }

      // paddle
      const half = (wideT > 0 ? 2.2 : 1.3);
      if (ballVel.y < 0 && ballPos.y <= -1.1 && ballPos.y > -1.9 && Math.abs(ballPos.x - paddleX) < half + 0.3) {
        ballPos.y = -1.05;
        const offset = (ballPos.x - paddleX) / half;
        const speed = Math.min(16, ballVel.length() * 1.03);
        ballVel.x = offset * speed * 0.85;
        ballVel.y = Math.abs(Math.sqrt(Math.max(1, speed * speed - ballVel.x * ballVel.x)));
      }

      // bricks
      for (const b of bricks) {
        if (!b.alive) continue;
        const p = b.mesh.position;
        if (Math.abs(ballPos.x - p.x) < 1.05 && Math.abs(ballPos.y - p.y) < 0.62) {
          b.alive = false;
          scene.remove(b.mesh);
          ballVel.y *= -1;
          score += 50;
          api.setScore(score);
          if (Math.random() < 0.12 && !powerup) {
            const p2 = box(0.75, 0.35, 0.75, 0x4b974b);
            p2.position.set(p.x, p.y, 3.2);
            scene.add(p2);
            powerup = { mesh: p2, y: p.y };
          }
          break;
        }
      }

      // powerup catch
      if (powerup) {
        powerup.mesh.position.y -= 3.2 * dt;
        powerup.mesh.rotation.y += dt * 3;
        if (powerup.mesh.position.y < -1.2 && Math.abs(powerup.mesh.position.x - paddleX) < 2) {
          wideT = 12;
          scene.remove(powerup.mesh);
          powerup = null;
        } else if (powerup.mesh.position.y < -2.6) {
          scene.remove(powerup.mesh);
          powerup = null;
        }
      }

      // fell
      if (ballPos.y < -3.2) {
        lives -= 1;
        api.setLives(Math.max(0, lives));
        if (lives <= 0) {
          api.gameOver();
        } else {
          resetBall();
        }
      }
    }

    // level clear
    if (bricks.every(b => !b.alive)) {
      level += 1;
      score += 250;
      api.setScore(score);
      buildWall();
      resetBall();
    }

    ball.position.copy(ballPos);
    renderer.render(scene, camera);
  };

  reset();
  return { reset, update, W, H };
}
