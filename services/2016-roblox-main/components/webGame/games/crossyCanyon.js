// Crossy Canyon - lane-hopping arcade (frogger-style). Canvas only, no game server.

const W = 800;
const H = 450;
const TILE = 48;
const COLS = 15;
const PLAY_W = COLS * TILE; // 720
const OX = (W - PLAY_W) / 2;
const MOVE_T = 0.13;
const CAR_COLORS = ['#c8372d', '#e67e22', '#f1c40f', '#3498db', '#9b59b6', '#e84393'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function createCrossyCanyon(api) {
  let rows, player, tween, cameraRow, score, over;

  const makeRow = (index) => {
    let type = 'grass';
    if (index > 0) {
      const r = Math.random();
      const prev = rows[index - 1] ? rows[index - 1].type : 'grass';
      if (prev === 'grass') type = r < 0.42 ? 'road' : r < 0.68 ? 'river' : 'grass';
      else type = r < 0.34 ? 'road' : r < 0.58 ? 'river' : 'grass';
    }
    const row = { index, type, dir: Math.random() < 0.5 ? 1 : -1, things: [] };
    if (type === 'road') {
      row.speed = rand(110, 240);
      const carW = rand(70, 120);
      const gap = rand(190, 320);
      for (let x = -PLAY_W; x < PLAY_W * 2; x += carW + gap) {
        row.things.push({ x: OX + rand(-40, 40) + x, w: carW, color: pick(CAR_COLORS), tall: Math.random() < 0.3 });
      }
    } else if (type === 'river') {
      row.speed = rand(55, 115);
      const logW = rand(150, 230);
      const gap = rand(110, 200);
      for (let x = -PLAY_W; x < PLAY_W * 2; x += logW + gap) {
        row.things.push({ x: OX + x, w: logW });
      }
    }
    return row;
  };

  const rowY = (index) => H - 70 - (index - cameraRow) * TILE;

  const reset = () => {
    rows = [];
    for (let i = 0; i < 30; i++) rows.push(makeRow(i));
    cameraRow = 0;
    score = 0;
    over = false;
    tween = null;
    player = { col: Math.floor(COLS / 2), row: 0 };
    api.setScore(0);
  };

  const playerPixel = () => {
    const baseX = OX + player.col * TILE + TILE / 2;
    const baseY = rowY(player.row) + TILE / 2;
    if (tween) {
      const k = 1 - tween.t / MOVE_T;
      return {
        x: baseX + (tween.fromX - baseX) * (1 - k),
        y: baseY + (tween.fromY - baseY) * (1 - k),
      };
    }
    return { x: baseX, y: baseY };
  };

  const die = () => {
    if (over) return;
    over = true;
    api.setScore(score);
    api.gameOver();
  };

  const move = (dc, dr) => {
    if (over || tween) return;
    const ncol = player.col + dc;
    const nrow = player.row + dr;
    if (ncol < 0 || ncol >= COLS || nrow < 0) return;
    const from = playerPixel();
    player.col = ncol;
    player.row = nrow;
    tween = { t: MOVE_T, fromX: from.x, fromY: from.y };
  };

  const update = (dt, input) => {
    if (over) return;

    if (tween) {
      tween.t -= dt;
      if (tween.t <= 0) tween = null;
    }

    if (input.pressed.up) move(0, 1);
    else if (input.pressed.down) move(0, -1);
    else if (input.pressed.left) move(-1, 0);
    else if (input.pressed.right) move(1, 0);
    else if (input.tapped && input.tapped.y < H * 0.55) move(0, 1);
    else if (input.tapped && input.tapped.x < W / 2) move(-1, 0);
    else if (input.tapped) move(1, 0);

    // scroll rows + camera
    for (const row of rows) {
      if (row.type === 'road' || row.type === 'river') {
        for (const thing of row.things) {
          thing.x += row.dir * row.speed * dt;
          if (thing.x > OX + PLAY_W + 60) thing.x = OX - thing.w - rand(40, 160);
          if (thing.x + thing.w < OX - 60) thing.x = OX + PLAY_W + rand(40, 160);
        }
      }
    }

    cameraRow = Math.max(0, player.row - 4);
    if (player.row > score) {
      score = player.row;
      api.setScore(score);
    }

    // hazards
    const px = playerPixel();
    const prow = rows[player.row];
    if (prow && prow.type === 'river') {
      const onLog = prow.things.some((t) => px.x > t.x - 6 && px.x < t.x + t.w + 6);
      if (!onLog) return die();
      // carry player with the log (adjust col via pixel drift -> snap gently)
      if (!tween) {
        const drift = prow.dir * prow.speed * dt;
        const newX = OX + player.col * TILE + TILE / 2 + drift;
        const newCol = Math.round((newX - OX - TILE / 2) / TILE);
        if (newCol >= 0 && newCol < COLS && newCol !== player.col) player.col = newCol;
      }
    }
    if (prow && prow.type === 'road') {
      const hit = prow.things.some(
        (t) => px.x > t.x - TILE * 0.32 && px.x < t.x + t.w + TILE * 0.32,
      );
      if (hit) return die();
    }

    // rows far above camera get regenerated below? keep static set of 30 - endless enough
    if (player.row > rows.length - 12) {
      const start = rows.length;
      for (let i = 0; i < 15; i++) rows.push(makeRow(start + i));
    }
  };

  const draw = (ctx) => {
    // backdrop
    ctx.fillStyle = '#87c774';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const y = rowY(i);
      if (y < -TILE || y > H + TILE) continue;
      if (row.type === 'grass') {
        ctx.fillStyle = i % 2 === 0 ? '#6fbf5e' : '#63b254';
        ctx.fillRect(OX, y, PLAY_W, TILE);
      } else if (row.type === 'road') {
        ctx.fillStyle = '#4a4f57';
        ctx.fillRect(OX, y, PLAY_W, TILE);
        ctx.fillStyle = '#c9c943';
        for (let x = OX + 12; x < OX + PLAY_W; x += 42) {
          ctx.fillRect(x, y + TILE / 2 - 2, 22, 4);
        }
      } else {
        ctx.fillStyle = '#3a86c8';
        ctx.fillRect(OX, y, PLAY_W, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let x = OX + 8; x < OX + PLAY_W; x += 60) {
          ctx.fillRect(x, y + 12, 28, 3);
          ctx.fillRect(x + 20, y + 30, 28, 3);
        }
      }
    }

    // cars & logs
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const y = rowY(i);
      if (y < -TILE || y > H + TILE) continue;
      for (const t of row.things) {
        if (t.x > OX + PLAY_W + 20 || t.x + t.w < OX - 20) continue;
        if (row.type === 'road') {
          const h = t.tall ? 34 : 26;
          ctx.fillStyle = t.color;
          ctx.fillRect(t.x, y + (TILE - h) / 2, t.w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(t.x + t.w * 0.55, y + (TILE - h) / 2 + 4, t.w * 0.28, h * 0.38);
          ctx.fillStyle = '#222';
          ctx.fillRect(t.x + 10, y + (TILE - h) / 2 + h - 5, 14, 7);
          ctx.fillRect(t.x + t.w - 24, y + (TILE - h) / 2 + h - 5, 14, 7);
        } else if (row.type === 'river') {
          ctx.fillStyle = '#8a5a2b';
          ctx.fillRect(t.x, y + 10, t.w, TILE - 20);
          ctx.fillStyle = '#6e441f';
          ctx.fillRect(t.x + 8, y + 16, t.w - 16, 5);
          ctx.fillRect(t.x + 8, y + TILE - 22, t.w - 16, 5);
        }
      }
    }

    // player (mini noob)
    const px = playerPixel();
    ctx.fillStyle = '#f5cd30';
    ctx.fillRect(px.x - 13, px.y - 22, 26, 12);
    ctx.fillRect(px.x - 19, px.y - 8, 7, 14);
    ctx.fillRect(px.x + 12, px.y - 8, 7, 14);
    ctx.fillStyle = '#0d69ac';
    ctx.fillRect(px.x - 12, px.y - 8, 24, 12);
    ctx.fillStyle = '#4b974b';
    ctx.fillRect(px.x - 11, px.y + 4, 10, 12);
    ctx.fillRect(px.x + 1, px.y + 4, 10, 12);
    ctx.fillStyle = '#222';
    ctx.fillRect(px.x - 6, px.y - 18, 3, 3);
    ctx.fillRect(px.x + 3, px.y - 18, 3, 3);
  };

  reset();
  return { reset, update, draw, W, H };
}
