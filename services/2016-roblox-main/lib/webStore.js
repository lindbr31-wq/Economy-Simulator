// Client-side data layer for the web games/catalog/avatar experience.
// Tries the Supabase-backed API first; falls back to localStorage so the
// whole experience works offline or without an account ("local mode").
import { GAMES, LOCAL_GAME_STATS, getGameById } from './gamesData';
import { CATALOG_ITEMS, DEFAULT_AVATAR, STARTER_WALLET, getItemById } from './catalogItems';

const isBrowser = typeof window !== 'undefined';
const LS_KEY = 'econWeb:v1';

const emptyLocal = () => ({
  wallet: { ...STARTER_WALLET },
  items: [],
  avatar: JSON.parse(JSON.stringify(DEFAULT_AVATAR)),
  scores: {},
  votes: {},
  plays: {},
  name: 'You',
});

let _local = null;
const local = () => {
  if (!isBrowser) return emptyLocal();
  if (_local) return _local;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    _local = raw ? { ...emptyLocal(), ...JSON.parse(raw) } : emptyLocal();
  } catch {
    _local = emptyLocal();
  }
  return _local;
};
const persist = () => {
  if (!isBrowser || !_local) return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(_local));
  } catch {
    /* private mode etc. - in-memory only */
  }
};

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
};

const firstError = (json, fallback) =>
  (json && json.errors && json.errors[0] && json.errors[0].message) || fallback;

// ---------- games ----------

const localGameRow = (g) => {
  const stats = { ...LOCAL_GAME_STATS[g.id], plays: (LOCAL_GAME_STATS[g.id] || {}).plays || 0 };
  const l = local();
  stats.plays += l.plays[g.id] || 0;
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    genre: g.genre,
    thumb_key: g.thumbKey,
    creator: g.creator,
    tagline: g.tagline,
    description: g.description,
    instructions: g.instructions,
    plays: stats.plays,
    likes: stats.likes,
    dislikes: stats.dislikes,
  };
};

export const getGames = async () => {
  try {
    const { res, json } = await api('/api/web/games');
    if (res.ok && json && json.data) return { games: json.data, mode: 'server' };
  } catch {
    /* fall through */
  }
  return { games: GAMES.map(localGameRow), mode: 'local' };
};

const LOCAL_SAMPLE_SCORES = {
  101: [
    { username: 'builderman', score: 4820 },
    { username: '1x1x1x1', score: 3990 },
    { username: 'Guest666', score: 2510 },
  ],
  102: [
    { username: 'builderman', score: 12400 },
    { username: 'Telamon', score: 11050 },
    { username: 'Guest42', score: 8300 },
  ],
  103: [
    { username: 'builderman', score: 97 },
    { username: 'NoobSlayer', score: 84 },
    { username: 'Guest1337', score: 71 },
  ],
};

export const getGameDetail = async (id) => {
  try {
    const { res, json } = await api('/api/web/games/' + Number(id));
    if (res.ok && json && json.data) return { ...json.data, mode: 'server' };
  } catch {
    /* fall through */
  }
  const g = getGameById(id);
  if (!g) return { error: 'Game not found' };
  const l = local();
  const mine = l.scores[g.id];
  const scores = [...(LOCAL_SAMPLE_SCORES[g.id] || [])];
  if (mine) scores.push({ username: l.name, score: mine.score, createdAt: mine.at });
  scores.sort((a, b) => b.score - a.score);
  return {
    game: localGameRow(g),
    scores: scores.slice(0, 10),
    myBest: mine ? mine.score : null,
    myVote: l.votes[g.id] || 0,
    mode: 'local',
  };
};

export const playGame = async (id) => {
  const l = local();
  l.plays[id] = (l.plays[id] || 0) + 1;
  persist();
  try {
    await api('/api/web/games/' + Number(id) + '/play', { method: 'POST' });
  } catch {
    /* local counter already bumped */
  }
};

export const submitScore = async (id, score) => {
  try {
    const { res, json } = await api('/api/web/games/' + Number(id) + '/score', {
      method: 'POST',
      body: { score },
    });
    if (res.status === 401) throw new Error('not_logged_in');
    if (res.ok && json && json.data) return { ...json.data, mode: 'server' };
    throw new Error(firstError(json, 'Could not save score'));
  } catch (e) {
    const l = local();
    const prev = l.scores[id] ? l.scores[id].score : 0;
    const best = Math.max(prev, score);
    l.scores[id] = { score: best, at: new Date().toISOString() };
    persist();
    return { score, best, mode: 'local', notLoggedIn: e.message === 'not_logged_in' };
  }
};

export const voteGame = async (id, vote) => {
  try {
    const { res, json } = await api('/api/web/games/' + Number(id) + '/vote', {
      method: 'POST',
      body: { vote },
    });
    if (res.status === 401) throw new Error('not_logged_in');
    if (res.ok && json && json.data) return { ...json.data, mode: 'server' };
    throw new Error(firstError(json, 'Could not save vote'));
  } catch (e) {
    const l = local();
    l.votes[id] = vote;
    persist();
    return { vote, mode: 'local', notLoggedIn: e.message === 'not_logged_in' };
  }
};

// ---------- catalog ----------

export const getCatalog = async ({ category = 'all', q = '' } = {}) => {
  try {
    const url = '/api/web/catalog?category=' + encodeURIComponent(category) + '&q=' + encodeURIComponent(q);
    const { res, json } = await api(url);
    if (res.ok && json && json.data) return { items: json.data, mode: 'server' };
  } catch {
    /* fall through */
  }
  let items = CATALOG_ITEMS.slice();
  if (category && category !== 'all') items = items.filter((i) => i.category === category);
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (i) => i.name.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle),
    );
  }
  return { items, mode: 'local' };
};

export const getItemDetail = async (id) => {
  try {
    const { res, json } = await api('/api/web/catalog/' + Number(id));
    if (res.ok && json && json.data) {
      const inv = local();
      return { ...json.data, mode: 'server' };
    }
  } catch {
    /* fall through */
  }
  const item = getItemById(id);
  if (!item) return { error: 'Item not found' };
  const owned = local().items.some((i) => i.id === item.id);
  return { item, owned, mode: 'local' };
};

export const buyItemLocal = (id) => {
  const l = local();
  const item = getItemById(id);
  if (!item) return { error: 'Item not found' };
  if (l.items.some((i) => i.id === item.id)) return { error: 'You already own this item' };
  const currency = item.currency;
  if (l.wallet[currency] < item.price) return { error: 'Not enough currency for this item' };
  l.wallet[currency] -= item.price;
  l.items.push({ id: item.id, price: item.price, currency, purchasedAt: new Date().toISOString() });
  persist();
  return { purchased: true, wallet: { ...l.wallet } };
};

export const buy = async (id) => {
  try {
    const { res, json } = await api('/api/web/catalog/' + Number(id) + '/buy', { method: 'POST' });
    if (res.status === 401) throw new Error('not_logged_in');
    if (res.ok && json && json.data) {
      return { ...json.data, mode: 'server' };
    }
    throw new Error(firstError(json, 'Could not buy this item'));
  } catch (e) {
    const r = buyItemLocal(id);
    return {
      ...r,
      mode: 'local',
      notLoggedIn: e.message === 'not_logged_in',
      error: r.error || undefined,
    };
  }
};

// ---------- inventory & avatar ----------

export const getInventory = async () => {
  try {
    const { res, json } = await api('/api/web/user/inv');
    if (res.status === 401) throw new Error('not_logged_in');
    if (res.ok && json && json.data) return { ...json.data, mode: 'server' };
  } catch (e) {
    if (e.message !== 'not_logged_in') {
      /* network - fall through to local */
    } else {
      return getLocalInventory('local');
    }
  }
  return getLocalInventory('local');
};

const getLocalInventory = (mode) => {
  const l = local();
  const items = l.items.map((owned) => {
    const def = getItemById(owned.id) || {};
    return {
      id: owned.id,
      name: def.name || 'Item',
      category: def.category || 'hats',
      price: owned.price,
      currency: owned.currency,
      art: def.art || null,
      purchased_at: owned.purchasedAt,
    };
  });
  return {
    username: l.name,
    wallet: { ...l.wallet },
    items,
    avatar: l.avatar,
    mode,
  };
};

export const saveAvatar = async (config) => {
  try {
    const { res, json } = await api('/api/web/user/avatar', { method: 'POST', body: { config } });
    if (res.status === 401) throw new Error('not_logged_in');
    if (res.ok && json && json.data) return { ...json.data, mode: 'server' };
    throw new Error(firstError(json, 'Could not save avatar'));
  } catch (e) {
    const l = local();
    l.avatar = config;
    persist();
    return { saved: true, config, mode: 'local', notLoggedIn: e.message === 'not_logged_in' };
  }
};

export const getMe = async () => {
  try {
    const { res, json } = await api('/api/auth/me');
    if (res.ok && json && json.username) return json;
  } catch {
    /* not logged in */
  }
  return null;
};
