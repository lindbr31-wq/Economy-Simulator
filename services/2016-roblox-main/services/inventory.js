import request, { getBaseUrl } from "../lib/request"
import { getFullUrl } from "../lib/request";
import axios from "axios";

const baseUrl = getFullUrl('inventory', '');

const CATEGORY_TYPE = {
  hats: { assetTypeId: 41, assetType: 'Hat' },
  faces: { assetTypeId: 18, assetType: 'Face' },
  shirts: { assetTypeId: 11, assetType: 'Shirt' },
  pants: { assetTypeId: 12, assetType: 'Pants' },
  gear: { assetTypeId: 19, assetType: 'Gear' },
};

// Local Supabase-backed inventory (2016 API shapes).
const fetchOwned = () =>
  axios.get('/api/web/user/inv').then(d => (d.data && d.data.data && d.data.data.items) || []);

export const getOwnedCopies = ({ assetId, userId }) => {
  return fetchOwned().then(items => {
    const owned = items.some(v => Number(v.id) === Number(assetId));
    return owned ? [{ userAssetId: 1, seller: null, price: null, serialNumber: null }] : [];
  }).catch(() => []);
}

export const getInventory = ({ userId, limit, cursor, assetTypeId }) => {
  return fetchOwned().then(items => {
    const t = CATEGORY_TYPE[items.category] || null;
    let rows = items;
    if (assetTypeId && Number(assetTypeId) !== 0) {
      const wanted = Number(assetTypeId);
      rows = rows.filter(v => {
        const info = CATEGORY_TYPE[v.category] || {};
        return info.assetTypeId === wanted;
      });
    }
    const lim = Number(limit) || 10;
    const start = cursor ? Number(cursor) : 0;
    const page = rows.slice(start, start + lim);
    return {
      Data: {
        Items: page.map(v => ({
          assetId: Number(v.id),
          AssetId: Number(v.id),
          name: v.name,
          Name: v.name,
          assetType: (CATEGORY_TYPE[v.category] || {}).assetType || 'Hat',
          assetTypeId: (CATEGORY_TYPE[v.category] || {}).assetTypeId || 41,
        })),
        nextPageCursor: start + lim < rows.length ? String(start + lim) : null,
        previousPageCursor: start > 0 ? String(Math.max(0, start - lim)) : null,
      },
    };
  });
}

export const getFavorites = ({ userId, limit, cursor, assetTypeId }) => {
  return Promise.resolve({
    Data: { Items: [], nextPageCursor: null, previousPageCursor: null },
  });
}

export const getCollections = ({ userId }) => {
  return Promise.resolve([]);
}

export const getCollectibleInventory = ({ userId, cursor, limit, assetTypeId = 'null' }) => {
  return Promise.resolve({ data: [], nextPageCursor: null, previousPageCursor: null });
}

export const getCollectibleOwners = ({ assetId, limit, sort, cursor }) => {
  return Promise.resolve({ data: [], nextPageCursor: null, previousPageCursor: null });
}
