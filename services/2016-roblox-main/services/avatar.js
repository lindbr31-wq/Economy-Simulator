import request from "../lib/request"
import axios from "axios";

// Local Supabase-backed avatar service keeping the 2016 API shapes.
// The customizer speaks brickColorIds; the web config stores hex colors.

export const BODY_COLOR_PALETTE = [
  { brickColorId: 1, hexColor: '#f5cd30', name: 'Bright yellow' },
  { brickColorId: 2, hexColor: '#fabe2c', name: 'Cool yellow' },
  { brickColorId: 3, hexColor: '#a4bd47', name: 'Earth green' },
  { brickColorId: 4, hexColor: '#4b974b', name: 'Bright green' },
  { brickColorId: 5, hexColor: '#3b7599', name: 'Br. yellowish orange' },
  { brickColorId: 6, hexColor: '#0d69ac', name: 'Bright blue' },
  { brickColorId: 7, hexColor: '#2966c0', name: 'Bright bluish green' },
  { brickColorId: 8, hexColor: '#6b4f2a', name: 'Reddish brown' },
  { brickColorId: 9, hexColor: '#d33a2c', name: 'Bright red' },
  { brickColorId: 10, hexColor: '#c4281c', name: 'Bright bluish red' },
  { brickColorId: 11, hexColor: '#f8f8f8', name: 'Institutional white' },
  { brickColorId: 12, hexColor: '#e2e2e2', name: 'Light stone grey' },
  { brickColorId: 13, hexColor: '#a3a2a5', name: 'Medium stone grey' },
  { brickColorId: 14, hexColor: '#635f62', name: 'Dark stone grey' },
  { brickColorId: 15, hexColor: '#232527', name: 'Really black' },
  { brickColorId: 16, hexColor: '#5b6352', name: 'Olive' },
  { brickColorId: 17, hexColor: '#c7753f', name: 'Nougat' },
  { brickColorId: 18, hexColor: '#e8bac0', name: 'Light reddish violet' },
  { brickColorId: 19, hexColor: '#923978', name: 'Magenta' },
  { brickColorId: 20, hexColor: '#4b2f6c', name: 'Bright violet' },
  { brickColorId: 21, hexColor: '#76635e', name: 'Br. yellowish orange 2' },
  { brickColorId: 22, hexColor: '#c98850', name: 'Nougat 2' },
  { brickColorId: 23, hexColor: '#8c5a34', name: 'Brown' },
  { brickColorId: 24, hexColor: '#7896c9', name: 'Pastel blue' },
];

const DEFAULT_BODY_COLOR_IDS = {
  headColorId: 1,
  torsoColorId: 6,
  leftArmColorId: 1,
  rightArmColorId: 1,
  leftLegColorId: 4,
  rightLegColorId: 4,
};

const hexToBrick = (hex) => {
  if (typeof hex === 'number') return hex;
  const entry = BODY_COLOR_PALETTE.find(v => String(v.hexColor).toLowerCase() === String(hex || '').toLowerCase());
  return entry ? entry.brickColorId : 1;
};

const brickToHex = (id) => {
  const entry = BODY_COLOR_PALETTE.find(v => v.brickColorId === Number(id));
  return entry ? entry.hexColor : '#f5cd30';
};

const HEX_KEYS = {
  headColorId: 'head',
  torsoColorId: 'torso',
  leftArmColorId: 'leftArm',
  rightArmColorId: 'rightArm',
  leftLegColorId: 'leftLeg',
  rightLegColorId: 'rightLeg',
};

const fetchOwnConfig = async () => {
  const me = await axios.get('/api/auth/me').then(d => d.data).catch(() => null);
  if (!me || !me.id) return null;
  const d = await axios.get('/api/web/users/' + me.id + '/avatar').then(r => r.data);
  return { me, data: d.data || {} };
};

const configToAssetIds = (cfg) => {
  const ids = [];
  if (cfg.shirtId) ids.push(Number(cfg.shirtId));
  if (cfg.pantsId) ids.push(Number(cfg.pantsId));
  if (cfg.faceId) ids.push(Number(cfg.faceId));
  if (cfg.gearId) ids.push(Number(cfg.gearId));
  (cfg.hatIds || []).forEach(h => ids.push(Number(h)));
  return ids;
};

const saveConfig = (config) =>
  axios.post('/api/web/user/avatar', { config }).then(d => d.data);

const CATEGORY_TYPE_NAME = { hats: 'Hat', faces: 'Face', shirts: 'Shirt', pants: 'Pants', gear: 'Gear' };

export const getRules = () => {
  return Promise.resolve({
    bodyColorsPalette: BODY_COLOR_PALETTE,
    playerAvatarTypes: ['R6'],
    wearableAssetTypes: [
      { id: 41, name: 'Hat' },
      { id: 18, name: 'Face' },
      { id: 11, name: 'Shirt' },
      { id: 12, name: 'Pants' },
      { id: 19, name: 'Gear' },
    ],
    limits: { hats: 3 },
  });
}

export const getAvatar = ({ userId }) => {
  // Currently-worn items for profile panels.
  return request('GET', '/api/web/users/' + userId + '/avatar').then(d => {
    const data = d.data.data || {};
    return { assets: data.equipped || [], bodyColors: (data.config && data.config.bodyColors) || {}, playerAvatarType: 'R6' };
  });
}

export const getMyAvatar = () => {
  return fetchOwnConfig().then(({ data }) => {
    const cfg = data.config || {};
    const colors = cfg.bodyColors || {};
    const bodyColors = {};
    Object.keys(HEX_KEYS).forEach(idKey => {
      bodyColors[idKey] = colors[HEX_KEYS[idKey]] ? hexToBrick(colors[HEX_KEYS[idKey]]) : DEFAULT_BODY_COLOR_IDS[idKey];
    });
    return {
      assets: (data.equipped || []).map(v => ({
        id: v.id,
        name: v.name,
        assetType: v.assetType || CATEGORY_TYPE_NAME[v.category] || 'Hat',
      })),
      bodyColors,
      playerAvatarType: 'R6',
    };
  });
}

export const redrawMyAvatar = () => {
  return Promise.resolve({});
}

export const setWearingAssets = ({ assetIds }) => {
  return fetchOwnConfig().then(async ({ data }) => {
    const current = data.config || {};
    const catalog = await axios.get('/api/web/catalog').then(r => (r.data.data || []));
    const byId = {};
    catalog.forEach(v => { byId[Number(v.id)] = v; });
    const hats = [];
    let faceId = null, shirtId = null, pantsId = null, gearId = null;
    (assetIds || []).map(Number).forEach(id => {
      const item = byId[id];
      if (!item) return;
      if (item.category === 'hats') hats.push(id);
      else if (item.category === 'faces') faceId = id;
      else if (item.category === 'shirts') shirtId = id;
      else if (item.category === 'pants') pantsId = id;
      else if (item.category === 'gear') gearId = id;
    });
    return saveConfig({
      ...current,
      hatIds: hats.slice(0, 3),
      faceId: faceId || 1010,
      shirtId,
      pantsId,
      gearId,
    });
  });
}

export const setColors = (bodyColors) => {
  return fetchOwnConfig().then(({ data }) => {
    const current = data.config || {};
    const colors = {};
    Object.keys(HEX_KEYS).forEach(idKey => {
      colors[HEX_KEYS[idKey]] = bodyColors && bodyColors[idKey] ? brickToHex(bodyColors[idKey]) : brickToHex(DEFAULT_BODY_COLOR_IDS[idKey]);
    });
    return saveConfig({ ...current, bodyColors: colors });
  });
}

export const getOutfits = ({ userId }) => {
  return Promise.resolve({ data: [] });
}

export const createOutfit = ({ name }) => {
  return Promise.resolve({});
}

export const wearOutfit = ({ outfitId }) => {
  return Promise.resolve();
}

export const deleteOutfit = ({ outfitId }) => {
  return Promise.resolve();
}

export const renameOutfit = ({ outfitId, name }) => {
  return Promise.resolve({});
}
