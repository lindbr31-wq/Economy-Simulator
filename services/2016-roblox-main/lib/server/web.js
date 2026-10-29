// Server-side helpers for the self-contained web games/catalog/avatar layer.
// Everything talks to Postgres through lib/server/db.js (SUPABASE_DB_URL).
import { query } from './db';
import { findUserById } from './db';
import { getSessionFromRequest } from './session';
import { STARTER_WALLET } from '../catalogItems';

// Resolves the logged-in user from the ECON_SESSION cookie, or null.
export const getSessionUser = async (req) => {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  const user = await findUserById(session.id);
  if (!user || user.status !== 1 || (user.session_key || 0) !== session.sessionKey) return null;
  return user;
};

// ---------- pure helpers (unit-tested) ----------

export const clampScore = (n) => {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return null;
  if (v < 0 || v > 10000000) return null;
  return v;
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const BODY_PARTS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

// Validates an avatar config against the user's owned items.
// owned: array of { id, category }. Returns { ok, error } or { ok: true, config }.
export const validateAvatarConfig = (config, owned) => {
  if (!config || typeof config !== 'object') return { ok: false, error: 'Missing avatar config' };
  const ownedIds = new Map((owned || []).map((o) => [Number(o.id), o.category]));
  const colors = config.bodyColors || {};
  const outColors = {};
  for (const part of BODY_PARTS) {
    const c = colors[part];
    if (typeof c !== 'string' || !HEX_COLOR.test(c)) {
      return { ok: false, error: `Invalid body color for ${part}` };
    }
    outColors[part] = c.toLowerCase();
  }

  const requireOwned = (id, category, label) => {
    if (id === null || id === undefined) return null;
    const num = Number(id);
    if (!Number.isInteger(num) || !ownedIds.has(num)) {
      return { ok: false, error: `You do not own that ${label}` };
    }
    if (ownedIds.get(num) !== category) {
      return { ok: false, error: `That item is not a ${label}` };
    }
    return num;
  };

  const hatsRaw = Array.isArray(config.hatIds) ? config.hatIds : [];
  if (hatsRaw.length > 3) return { ok: false, error: 'You can only wear up to 3 hats' };
  const hats = [];
  for (const h of hatsRaw) {
    const num = Number(h);
    if (!Number.isInteger(num) || !ownedIds.has(num)) return { ok: false, error: 'You do not own that hat' };
    if (ownedIds.get(num) !== 'hats') return { ok: false, error: 'That item is not a hat' };
    if (!hats.includes(num)) hats.push(num);
  }

  const faceId = requireOwned(config.faceId, 'faces', 'face');
  if (faceId && faceId.ok === false) return faceId;
  const shirtId = requireOwned(config.shirtId, 'shirts', 'shirt');
  if (shirtId && shirtId.ok === false) return shirtId;
  const pantsId = requireOwned(config.pantsId, 'pants', 'pants');
  if (pantsId && pantsId.ok === false) return pantsId;
  const gearId = requireOwned(config.gearId, 'gear', 'gear');
  if (gearId && gearId.ok === false) return gearId;

  return {
    ok: true,
    config: {
      bodyColors: outColors,
      hatIds: hats,
      faceId: faceId || null,
      shirtId: shirtId || null,
      pantsId: pantsId || null,
      gearId: gearId || null,
    },
  };
};

// ---------- db helpers ----------

export const ensureWebUser = async (userId) => {
  await query(
    `INSERT INTO web_user_wallet (user_id, robux, tix) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, STARTER_WALLET.robux, STARTER_WALLET.tix],
  );
  await query(
    `INSERT INTO web_user_avatar (user_id, config) VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, JSON.stringify({ bodyColors: null, hatIds: [], faceId: 1010, shirtId: null, pantsId: null, gearId: null })],
  );
};

export const listGames = async () => {
  const r = await query(
    `SELECT id, name, slug, genre, thumb_key, creator, tagline, description, instructions,
            plays, likes, dislikes
     FROM web_game ORDER BY id ASC`,
  );
  return r.rows;
};

export const getGame = async (id) => {
  const r = await query(`SELECT * FROM web_game WHERE id = $1`, [id]);
  return r.rows[0] || null;
};

export const recordPlay = async (id) => {
  await query(`UPDATE web_game SET plays = plays + 1 WHERE id = $1`, [id]);
};

export const getTopScores = async (gameId, limit = 10) => {
  const r = await query(
    `SELECT username, score, created_at FROM web_game_score
     WHERE game_id = $1 ORDER BY score DESC, created_at ASC LIMIT $2`,
    [gameId, limit],
  );
  return r.rows;
};

export const getMyScore = async (gameId, userId) => {
  const r = await query(`SELECT score FROM web_game_score WHERE game_id = $1 AND user_id = $2`, [gameId, userId]);
  return r.rows[0] ? Number(r.rows[0].score) : null;
};

export const getMyVote = async (gameId, userId) => {
  const r = await query(`SELECT vote FROM web_game_vote WHERE game_id = $1 AND user_id = $2`, [gameId, userId]);
  return r.rows[0] ? Number(r.rows[0].vote) : 0;
};

// Best-score upsert: keeps one row per (game, user).
export const submitScore = async (gameId, userId, username, score) => {
  const r = await query(
    `INSERT INTO web_game_score (game_id, user_id, username, score)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (game_id, user_id)
     DO UPDATE SET score = GREATEST(web_game_score.score, EXCLUDED.score),
                   username = EXCLUDED.username,
                   created_at = CASE WHEN EXCLUDED.score > web_game_score.score
                                     THEN now() ELSE web_game_score.created_at END
     RETURNING score`,
    [gameId, userId, username, score],
  );
  return Number(r.rows[0].score);
};

export const voteGame = async (gameId, userId, vote) => {
  const prev = await getMyVote(gameId, userId);
  if (prev === vote) return { likes: null, dislikes: null, vote };
  // adjust counters atomically with the vote row
  await query(
    `INSERT INTO web_game_vote (user_id, game_id, vote) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, game_id) DO UPDATE SET vote = EXCLUDED.vote, updated_at = now()`,
    [userId, gameId, vote],
  );
  if (prev === 1) await query(`UPDATE web_game SET likes = GREATEST(likes - 1, 0) WHERE id = $1`, [gameId]);
  if (prev === -1) await query(`UPDATE web_game SET dislikes = GREATEST(dislikes - 1, 0) WHERE id = $1`, [gameId]);
  if (vote === 1) await query(`UPDATE web_game SET likes = likes + 1 WHERE id = $1`, [gameId]);
  if (vote === -1) await query(`UPDATE web_game SET dislikes = dislikes + 1 WHERE id = $1`, [gameId]);
  const g = await getGame(gameId);
  return { likes: Number(g.likes), dislikes: Number(g.dislikes), vote };
};

export const listItems = async ({ category, q } = {}) => {
  const where = [];
  const params = [];
  if (category && category !== 'all') {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  const sql =
    `SELECT id, name, description, category, price, currency, art FROM web_catalog_item` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY category, id`;
  const r = await query(sql, params);
  return r.rows;
};

export const getItem = async (id) => {
  const r = await query(`SELECT id, name, description, category, price, currency, art FROM web_catalog_item WHERE id = $1`, [id]);
  return r.rows[0] || null;
};

// Atomic purchase: single statement so balance check + deduction + insert
// cannot race. Returns { ok:1 }, { owned:1 }, { error:'insufficient' }.
export const buyItem = async (userId, itemId) => {
  const item = await getItem(itemId);
  if (!item) return { error: 'no_item' };
  const robux = item.currency === 'robux' ? Number(item.price) : 0;
  const tix = item.currency === 'tix' ? Number(item.price) : 0;
  const r = await query(
    `WITH owned AS (
       SELECT 1 FROM web_user_item WHERE user_id = $1 AND item_id = $2
     ), deducted AS (
       UPDATE web_user_wallet
       SET robux = robux - $3, tix = tix - $4, updated_at = now()
       WHERE user_id = $1
         AND NOT EXISTS (SELECT 1 FROM owned)
         AND robux >= $3 AND tix >= $4
       RETURNING user_id
     ), inserted AS (
       INSERT INTO web_user_item (user_id, item_id, price, currency)
       SELECT $1, $2, $5, $6 FROM deducted
       ON CONFLICT (user_id, item_id) DO NOTHING
       RETURNING id
     )
     SELECT (SELECT count(*) FROM owned) AS already_owned,
            (SELECT count(*) FROM deducted) AS deducted,
            (SELECT count(*) FROM inserted) AS inserted`,
    [userId, item.id, robux, tix, item.price, item.currency],
  );
  const row = r.rows[0];
  if (Number(row.already_owned) > 0) return { owned: 1 };
  if (Number(row.inserted) === 1) return { ok: 1 };
  return { error: 'insufficient' };
};

export const getInventory = async (userId) => {
  await ensureWebUser(userId);
  const wallet = await query(`SELECT robux, tix FROM web_user_wallet WHERE user_id = $1`, [userId]);
  const items = await query(
    `SELECT ui.item_id AS id, c.name, c.category, c.price, c.currency, c.art, ui.purchased_at
     FROM web_user_item ui JOIN web_catalog_item c ON c.id = ui.item_id
     WHERE ui.user_id = $1 ORDER BY ui.purchased_at DESC`,
    [userId],
  );
  const avatar = await query(`SELECT config, updated_at FROM web_user_avatar WHERE user_id = $1`, [userId]);
  return {
    wallet: {
      robux: Number(wallet.rows[0].robux),
      tix: Number(wallet.rows[0].tix),
    },
    items: items.rows,
    avatar: avatar.rows[0] ? avatar.rows[0].config : null,
  };
};

export const saveAvatar = async (userId, config) => {
  await ensureWebUser(userId);
  await query(`UPDATE web_user_avatar SET config = $2, updated_at = now() WHERE user_id = $1`, [userId, JSON.stringify(config)]);
  return config;
};

export const getOwnedItems = async (userId) => {
  const r = await query(
    `SELECT ui.item_id AS id, c.category FROM web_user_item ui
     JOIN web_catalog_item c ON c.id = ui.item_id WHERE ui.user_id = $1`,
    [userId],
  );
  return r.rows;
};

// ---------- users / friends / presence (whole site is one big friend list) ----------

export const countUsers = async (keyword = '') => {
  const params = keyword ? [`%${keyword}%`] : [];
  const where = keyword ? `WHERE username ILIKE $1` : '';
  const r = await query(`SELECT count(*)::int AS n FROM "user" ${where}`, params);
  return r.rows[0].n;
};

export const listUsers = async ({ keyword = '', limit = 12, offset = 0 } = {}) => {
  const params = [];
  let where = '';
  if (keyword) {
    params.push(`%${keyword}%`);
    where = `WHERE username ILIKE $1`;
  }
  params.push(limit, offset);
  const r = await query(
    `SELECT id, username, description, created_at, online_at FROM "user"
     ${where} ORDER BY username ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return r.rows.map(toPublicUser);
};

const toPublicUser = (row) => ({
  id: Number(row.id),
  name: row.username,
  username: row.username,
  displayName: row.username,
  description: row.description || '',
  created: row.created_at,
  isBanned: false,
  hasVerifiedBadge: false,
  online_at: row.online_at,
});

export const getUserPublic = async (id) => {
  const r = await query(`SELECT id, username, description, created_at, online_at FROM "user" WHERE id = $1`, [id]);
  return r.rows[0] ? toPublicUser(r.rows[0]) : null;
};

// Everyone on the site is friends with everyone. Friends of X = all users but X.
export const listFriends = async (userId) => {
  const r = await query(
    `SELECT id, username, description, created_at, online_at FROM "user"
     WHERE id <> $1 AND status = 1 ORDER BY username ASC`,
    [userId],
  );
  return r.rows.map(toPublicUser);
};

export const getPresence = async (userIds) => {
  const ids = (Array.isArray(userIds) ? userIds : []).map(Number).filter((n) => Number.isInteger(n)).slice(0, 100);
  if (ids.length === 0) return [];
  const r = await query(`SELECT id, online_at FROM "user" WHERE id = ANY($1)`, [ids]);
  const now = Date.now();
  return r.rows.map((row) => {
    const onlineAt = row.online_at ? new Date(row.online_at).getTime() : 0;
    const isOnline = now - onlineAt < 5 * 60 * 1000;
    return {
      userId: Number(row.id),
      lastLocation: isOnline ? 'Website' : '',
      placeId: null,
      rootPlaceId: null,
      gameId: null,
      universeId: null,
      userPresenceType: isOnline ? 'Online' : 'Offline',
      lastOnline: row.online_at || new Date().toISOString(),
    };
  });
};

// Equipped avatar items for the "Currently Wearing" panel.
export const getEquippedItems = async (userId) => {
  const avatar = await query(`SELECT config FROM web_user_avatar WHERE user_id = $1`, [userId]);
  const cfg = avatar.rows[0] ? avatar.rows[0].config : null;
  const ids = [];
  if (cfg) {
    if (cfg.faceId) ids.push(Number(cfg.faceId));
    if (cfg.shirtId) ids.push(Number(cfg.shirtId));
    if (cfg.pantsId) ids.push(Number(cfg.pantsId));
    if (cfg.gearId) ids.push(Number(cfg.gearId));
    (cfg.hatIds || []).forEach((h) => ids.push(Number(h)));
  }
  if (ids.length === 0) return [];
  const r = await query(`SELECT id, name FROM web_catalog_item WHERE id = ANY($1)`, [ids]);
  return r.rows.map((row) => ({ id: Number(row.id), name: row.name }));
};

export const getUserAvatarConfig = async (userId) => {
  const r = await query(`SELECT config FROM web_user_avatar WHERE user_id = $1`, [userId]);
  return r.rows[0] && r.rows[0].config && r.rows[0].config.bodyColors ? r.rows[0].config : null;
};
