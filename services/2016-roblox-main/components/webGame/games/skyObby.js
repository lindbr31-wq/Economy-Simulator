// Sky Obby: Tower Trials - endless vertical platformer.
// Pure canvas + math, no game server. Scores are submitted by the client shell.

const W = 800;
const H = 450;
const GRAVITY = 2100;
const JUMP_V = -800;
const MOVE_SPEED = 290;
const PLAYER_W = 28;
const PLAYER_H = 36;

const rand = (a, b) => a + Math.random() * (b - a);

export default function createSkyObby(api) {
  let player, platforms, coins, camY, startY, lives, coinsTaken, deadTimer, lastPlatform;

  const makePlatform = (x, y, w, type) => ({
    x, y, w, h: 18, type, vx: type === 'moving' ? (Math.random() < 0.5 ? -1 : 1) * rand(50, 110) : 0,
    fadeState: 'solid', fadeT: 0, touched: false,
  });

  const generateTo = (targetY) => {
    let last = platforms[platforms.length - 1];
    while (last.y > targetY) {
      const gap = rand(70, 115);
      const w = rand(100, 180);
      const x = rand(16, W - w - 16);
      const y = last.y - gap;
      const r = Math.random();
      const type = r < 0.16 ? 'moving' : r < 0.28 ? 'fade' : 'static';
      const p = makePlatform(x, y, w, type);
      platforms.push(p);
      if (Math.random() < 0.32) {
        coins.push({ x: x + w / 2, y: y - 26, taken: false, t: Math.random() * Math.PI * 2 });
      }
      last = p;
    }
  };

  const respawn = () => {
    const p = lastPlatform || platforms[0];
    player.x = p.x + p.w / 2 - PLAYER_W / 2;
    player.y = p.y - PLAYER_H - 2;
    player.vx = 0;
    player.vy = 0;
    deadTimer = 0.6;
  };

  const reset = () => {
    player = { x: 330, y: 300, vx: 0, vy: 0, onGround: false, face: 1 };
    platforms = [makePlatform(300, 380, 200, 'static')];
    coins = [];
    for (let i = 0; i < 8; i++) {
      const last = platforms[platforms.length - 1];
      const p = makePlatform(rand(16, W - 180), last.y - rand(70, 110), rand(110, 180), 'static');
      platforms.push(p);
      if (Math.random() < 0.3) coins.push({ x: p.x + p.w / 2, y: p.y - 26, taken: false, t: 0 });
    }
    startY = 300;
    camY = 0;
    lives = 3;
    coinsTaken = 0;
    deadTimer = 0.5;
    lastPlatform = platforms[0];
    api.setScore(0);
  };

  const altitudeScore = () => Math.max(0, Math.floor((startY - player.y) / 8));

  const update = (dt, input) => {
    if (deadTimer > 0) {
      deadTimer -= dt;
      return;
    }
    // horizontal
    const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    player.vx = dir * MOVE_SPEED;
    if (dir !== 0) player.face = dir;
    player.x += player.vx * dt;
    if (player.x < 4) player.x = 4;
    if (player.x + PLAYER_W > W - 4) player.x = W - 4 - PLAYER_W;

    // jump (edge) + variable height
    if (input.pressed.jump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }
    if (!input.held.jump && player.vy < JUMP_V * 0.45) player.vy = JUMP_V * 0.45;

    player.vy += GRAVITY * dt;
    const prevBottom = player.y + PLAYER_H;
    player.y += player.vy * dt;

    // moving platforms
    for (const p of platforms) {
      if (p.type === 'moving') {
        p.x += p.vx * dt;
        if (p.x < 8 || p.x + p.w > W - 8) p.vx *= -1;
      }
      if (p.type === 'fade') {
        if (p.fadeState === 'fading') {
          p.fadeT -= dt;
          if (p.fadeT <= 0) { p.fadeState = 'gone'; p.fadeT = 2.2; }
        } else if (p.fadeState === 'gone') {
          p.fadeT -= dt;
          if (p.fadeT <= 0) { p.fadeState = 'solid'; p.touched = false; }
        }
      }
    }

    // collisions (land on top)
    player.onGround = false;
    if (player.vy >= 0) {
      for (const p of platforms) {
        if (p.fadeState === 'gone') continue;
        const bottom = player.y + PLAYER_H;
        if (
          prevBottom <= p.y + 8 &&
          bottom >= p.y &&
          player.x + PLAYER_W > p.x &&
          player.x < p.x + p.w
        ) {
          player.y = p.y - PLAYER_H;
          player.vy = 0;
          player.onGround = true;
          lastPlatform = p;
          if (p.type === 'moving') player.x += p.vx * dt;
          if (p.type === 'fade' && !p.touched) {
            p.touched = true;
            p.fadeState = 'fading';
            p.fadeT = 0.75;
          }
          break;
        }
      }
    }

    // coins
    for (const c of coins) {
      if (c.taken) continue;
      c.t += dt * 4;
      const cx = player.x + PLAYER_W / 2;
      const cy = player.y + PLAYER_H / 2;
      if (Math.abs(cx - c.x) < 26 && Math.abs(cy - c.y) < 30) {
        c.taken = true;
        coinsTaken++;
      }
    }

    // camera follows upward only
    const targetCam = Math.min(player.y - 220, camY);
    camY = targetCam;

    // fell off screen
    if (player.y > camY + H + 160) {
      lives--;
      if (lives <= 0) {
        api.setScore(altitudeScore() + coinsTaken * 25);
        api.gameOver();
        return;
      }
      respawn();
    }

    // cull far-below platforms
    if (platforms.length > 60) {
      platforms = platforms.filter((p) => p.y < camY + H + 400);
      coins = coins.filter((c) => !c.taken && c.y < camY + H + 400);
    }
    generateTo(camY - 500);

    api.setScore(altitudeScore() + coinsTaken * 25);
    api.setLives(lives);
  };

  const draw = (ctx) => {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6ec6ff');
    g.addColorStop(1, '#c9ecff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // clouds (parallax)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 173 + 40) % (W + 120)) - 60;
      const cy = ((i * 220 - camY * 0.25) % (H + 200)) - 100;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 52, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 34, cy - 10, 34, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 32, cy - 6, 28, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const oy = -camY;

    // platforms with studs
    for (const p of platforms) {
      const y = p.y + oy;
      if (y > H + 40 || y < -40) continue;
      let base = '#3b6ea5';
      if (p.type === 'moving') base = '#e08a2e';
      if (p.type === 'fade') base = p.fadeState === 'gone' ? null : p.fadeState === 'fading' ? 'rgba(120,80,200,0.55)' : '#7b4fc0';
      if (!base) continue;
      ctx.fillStyle = base;
      ctx.fillRect(p.x, y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(p.x, y, p.w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let sx = p.x + 12; sx < p.x + p.w - 8; sx += 26) {
        ctx.beginPath();
        ctx.arc(sx, y + p.h / 2 + 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // coins
    for (const c of coins) {
      if (c.taken) continue;
      const y = c.y + oy;
      if (y > H + 30 || y < -30) continue;
      const wobble = Math.sin(c.t) * 4;
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.ellipse(c.x, y + wobble, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c79a12';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // player (mini noob)
    const px = player.x;
    const py = player.y + oy;
    if (deadTimer <= 0) {
      ctx.fillStyle = '#f5cd30'; // head + arms
      ctx.fillRect(px + 4, py, 20, 14);
      ctx.fillRect(px - 4, py + 16, 8, 16);
      ctx.fillRect(px + PLAYER_W - 4, py + 16, 8, 16);
      ctx.fillStyle = '#0d69ac'; // torso
      ctx.fillRect(px + 2, py + 14, PLAYER_W - 4, 12);
      ctx.fillStyle = '#4b974b'; // legs
      ctx.fillRect(px + 3, py + 26, 10, 10);
      ctx.fillRect(px + 15, py + 26, 10, 10);
      // face
      ctx.fillStyle = '#222';
      const fx = player.face > 0 ? 1 : -1;
      ctx.fillRect(px + 10 + fx * 3, py + 5, 3, 3);
      ctx.fillRect(px + 17 + fx * 3, py + 5, 3, 3);
    }
  };

  reset();
  return { reset, update, draw, W, H };
}
