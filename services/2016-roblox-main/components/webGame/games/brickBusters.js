// Brick Busters - classic breakout-style arcade. Canvas only, no game server.

const W = 800;
const H = 450;
const PADDLE_Y = H - 46;
const BALL_R = 9;
const BASE_SPEED = 340;
const ROW_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];

const rand = (a, b) => a + Math.random() * (b - a);

export default function createBrickBusters(api) {
  let paddle, ball, bricks, level, lives, state, wideT, particles;

  const buildBricks = () => {
    bricks = [];
    const cols = 10;
    const rows = 5 + Math.min(level, 3);
    const margin = 40;
    const bw = (W - margin * 2) / cols;
    const bh = 22;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: margin + c * bw,
          y: 56 + r * (bh + 5),
          w: bw - 5,
          h: bh,
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true,
        });
      }
    }
  };

  const stickBall = () => {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = PADDLE_Y - BALL_R - 2;
    ball.vx = 0;
    ball.vy = 0;
    state = 'ready';
  };

  const reset = () => {
    paddle = { x: W / 2 - 55, w: 110, h: 14 };
    ball = { x: 0, y: 0, vx: 0, vy: 0 };
    level = 1;
    lives = 3;
    wideT = 0;
    particles = [];
    buildBricks();
    stickBall();
    api.setScore(0);
    api.setLives(lives);
  };

  const launch = () => {
    const speed = BASE_SPEED + (level - 1) * 32;
    const angle = rand(-0.6, 0.6) - Math.PI / 2;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    state = 'playing';
  };

  const burst = (x, y, color) => {
    for (let i = 0; i < 8; i++) {
      particles.push({ x, y, vx: rand(-90, 90), vy: rand(-120, 30), t: 0.35, color });
    }
  };

  const update = (dt, input, apiRef) => {
    // paddle control
    if (input.held.left) paddle.x -= 520 * dt;
    if (input.held.right) paddle.x += 520 * dt;
    if (input.pointer.down || input.pointer.x !== null) {
      const target = input.pointer.x - paddle.w / 2;
      paddle.x += (target - paddle.x) * Math.min(1, dt * 16);
    }
    paddle.x = Math.max(6, Math.min(W - paddle.w - 6, paddle.x));

    if (wideT > 0) {
      wideT -= dt;
      if (wideT <= 0) {
        const center = paddle.x + paddle.w / 2;
        paddle.w = 110;
        paddle.x = center - paddle.w / 2;
      }
    }

    if (state === 'ready') {
      stickBall();
      if (input.pressed.jump || input.tapped || (input.pointer.down && input.pressed.pointer)) launch();
      return;
    }

    // ball physics (substeps for clean brick hits)
    const steps = 2;
    for (let s = 0; s < steps; s++) {
      ball.x += (ball.vx * dt) / steps;
      ball.y += (ball.vy * dt) / steps;

      if (ball.x - BALL_R < 4) { ball.x = 4 + BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x + BALL_R > W - 4) { ball.x = W - 4 - BALL_R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - BALL_R < 4) { ball.y = 4 + BALL_R; ball.vy = Math.abs(ball.vy); }

      // paddle
      if (
        ball.vy > 0 &&
        ball.y + BALL_R >= PADDLE_Y &&
        ball.y + BALL_R <= PADDLE_Y + paddle.h + 12 &&
        ball.x >= paddle.x - BALL_R &&
        ball.x <= paddle.x + paddle.w + BALL_R
      ) {
        ball.y = PADDLE_Y - BALL_R;
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const speed = Math.hypot(ball.vx, ball.vy);
        const angle = hit * 1.05 - Math.PI / 2;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        if (Math.abs(ball.vy) < 120) ball.vy = ball.vy < 0 ? -120 : 120;
      }

      // bricks
      for (const b of bricks) {
        if (!b.alive) continue;
        if (
          ball.x + BALL_R > b.x &&
          ball.x - BALL_R < b.x + b.w &&
          ball.y + BALL_R > b.y &&
          ball.y - BALL_R < b.y + b.h
        ) {
          b.alive = false;
          burst(b.x + b.w / 2, b.y + b.h / 2, b.color);
          api.addScore(50 * level);
          const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + b.w - (ball.x - BALL_R));
          const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + b.h - (ball.y - BALL_R));
          if (overlapX < overlapY) ball.vx = -ball.vx;
          else ball.vy = -ball.vy;
          if (Math.random() < 0.12 && wideT <= 0 && paddle.w <= 110) {
            particles.push({ x: b.x + b.w / 2, y: b.y, vx: 0, vy: 130, t: 999, color: '#2ecc71', powerup: true });
          }
          break;
        }
      }
    }

    // particles & powerups
    for (const p of particles) {
      if (p.powerup) {
        p.y += p.vy * dt;
        if (
          p.y > PADDLE_Y - 6 &&
          p.y < PADDLE_Y + 26 &&
          p.x > paddle.x - 10 &&
          p.x < paddle.x + paddle.w + 10
        ) {
          p.t = 0;
          const center = paddle.x + paddle.w / 2;
          paddle.w = 176;
          paddle.x = center - paddle.w / 2;
          wideT = 12;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        p.t -= dt;
      }
    }
    particles = particles.filter((p) => p.t > 0 && p.y < H + 20);

    // fell out
    if (ball.y - BALL_R > H) {
      lives--;
      api.setLives(lives);
      if (lives <= 0) {
        api.gameOver();
        return;
      }
      stickBall();
    }

    // level clear
    if (bricks.every((b) => !b.alive)) {
      level++;
      api.addScore(250);
      buildBricks();
      stickBall();
    }
  };

  const draw = (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141b2d');
    g.addColorStop(1, '#25334f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(b.x, b.y, b.w, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    }

    for (const p of particles) {
      if (p.powerup) {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(p.x - 12, p.y - 8, 24, 16);
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x - 7, p.y - 2, 14, 4);
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.t * 3));
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        ctx.globalAlpha = 1;
      }
    }

    // paddle
    ctx.fillStyle = '#e8eef5';
    const pw = paddle.w;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(paddle.x, PADDLE_Y, pw, paddle.h, 8) : ctx.rect(paddle.x, PADDLE_Y, pw, paddle.h);
    ctx.fill();
    ctx.fillStyle = '#3fc1c9';
    ctx.fillRect(paddle.x + 6, PADDLE_Y + 3, pw - 12, 4);

    // ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 3, BALL_R * 0.4, 0, Math.PI * 2);
    ctx.fill();
  };

  reset();
  return { reset, update, draw, W, H };
}
