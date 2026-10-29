import request, { getFullUrl } from "../lib/request";
import axios from "axios";

export const itemNameToEncodedName = (str) => {
  return encodeURIComponent(str.replace(/ /g, '-'));
}

export const getItemUrl = ({ assetId, name }) => {
  return '/catalog/' + assetId + '/' + itemNameToEncodedName(name);
}

// ---- local Supabase-backed catalog (keeps the 2016 API shapes) ----

const CATEGORY_TYPE = {
  hats: { assetTypeId: 41, assetType: 'Hat' },
  faces: { assetTypeId: 18, assetType: 'Face' },
  shirts: { assetTypeId: 11, assetType: 'Shirt' },
  pants: { assetTypeId: 12, assetType: 'Pants' },
  gear: { assetTypeId: 19, assetType: 'Gear' },
};

const mapItem = (row) => {
  const t = CATEGORY_TYPE[row.category] || CATEGORY_TYPE.hats;
  return {
    id: Number(row.id),
    itemType: 'Asset',
    assetTypeId: t.assetTypeId,
    assetType: t.assetTypeId,
    name: row.name,
    description: row.description || '',
    creator: { id: 1, name: 'EconomySim Games', type: 'User', hasVerifiedBadge: false },
    iconUrl: '/api/web/items/' + row.id + '/icon',
    price: Number(row.price),
    priceTickets: row.currency === 'tix' ? Number(row.price) : null,
    priceType: row.currency === 'tix' ? 'Tickets' : 'Robux',
    productId: Number(row.id),
    sellerId: 1,
    userAssetId: null,
    isForSale: true,
    isLimited: false,
    isLimitedUnique: false,
    isPublicDomain: false,
    isPending: false,
    lowestPrice: null,
    unitsAvailableForConsumption: null,
    sales: 0,
    favoritedCount: 0,
    created: new Date(2016, 5, 1).toISOString(),
    updated: new Date(2016, 5, 1).toISOString(),
    art: row.art,
    category: row.category,
  };
};

const mapGameAsPlace = (row) => ({
  id: Number(row.id),
  itemType: 'Asset',
  assetTypeId: 9,
  assetType: 9,
  genres: row.genre ? [row.genre] : [],
  assetType: 'Place',
  name: row.name,
  description: row.description || '',
  creator: { id: 1, name: row.creator || 'EconomySim Games', type: 'User', hasVerifiedBadge: false },
  iconUrl: '/api/web/games/' + row.id + '/icon',
  price: null,
  productId: Number(row.id),
  sellerId: 1,
  isForSale: false,
  isLimited: false,
  isLimitedUnique: false,
  isPublicDomain: false,
  isPending: false,
  sales: 0,
  favoritedCount: 0,
});

const fetchCatalogItems = () =>
  axios.get('/api/web/catalog').then(d => (d.data.data || []).map(mapItem));

const fetchGames = () =>
  axios.get('/api/web/games').then(d => (d.data.data || []).map(mapGameAsPlace));

const matchesSubCategory = (item, subCategory) => {
  const s = String(subCategory || '').toLowerCase().trim();
  if (!s || s === 'all' || s === 'items') return true;
  const cat = item.category;
  if (s === 'hats') return cat === 'hats';
  if (s === 'face' || s === 'faces') return cat === 'faces';
  if (s === 'shirts' || s === 'tshirts') return cat === 'shirts';
  if (s === 'pants') return cat === 'pants';
  if (['gear', 'building', 'explosive', 'melee', 'musical', 'navigation', 'powerup', 'ranged', 'social', 'transport'].includes(s)) return cat === 'gear';
  return true;
};

const matchesCategory = (item, category) => {
  const c = String(category || '').toLowerCase().trim();
  if (!c || c === 'featured' || c === 'all') return true;
  if (c === 'accessories' || c === 'collectible' || c === 'collectibles') return item.category === 'hats';
  if (c === 'clothing') return item.category === 'shirts' || item.category === 'pants';
  if (c === 'gear' || c === 'gears') return item.category === 'gear';
  if (c === 'bodyparts') return item.category === 'faces';
  return true;
};

export const searchCatalog = ({ category, subCategory, query, limit, cursor, sort, creatorType, creatorId }) => {
  return fetchCatalogItems().then(items => {
    let rows = items.filter(v =>
      matchesCategory(v, category) &&
      matchesSubCategory(v, subCategory) &&
      (!query || v.name.toLowerCase().includes(String(query).toLowerCase()))
    );
    // sortType: 0 relevance, 1 most favorited, 2 bestselling, 3 price asc, 4 price desc, 5 updated
    const sortNum = Number(sort) || 0;
    if (sortNum === 3) rows = rows.slice().sort((a, b) => a.price - b.price);
    else if (sortNum === 4) rows = rows.slice().sort((a, b) => b.price - a.price);
    const startIndex = cursor ? Number(cursor) : 0;
    const lim = Number(limit) || 30;
    const page = rows.slice(startIndex, startIndex + lim);
    return {
      data: page,
      nextPageCursor: startIndex + lim < rows.length ? String(startIndex + lim) : null,
      previousPageCursor: startIndex > 0 ? String(Math.max(0, startIndex - lim)) : null,
    };
  });
}

/**
 * Only use this on server-side requests.
 * @param {number} assetId
 */
export const getProductInfoLegacy = async (assetId) => {
  const all = (await fetchCatalogItems()).concat(await fetchGames());
  const item = all.find(v => v.id === Number(assetId));
  if (!item) return {};
  return {
    AssetId: item.id,
    ProductId: item.productId,
    Name: item.name,
    Description: item.description,
    AssetTypeId: item.assetTypeId,
    Creator: { Id: item.creator.id, Name: item.creator.name, CreatorType: item.creator.type },
    PriceInRobux: item.priceType === 'Robux' ? item.price : null,
    PriceInTickets: item.priceType === 'Tickets' ? item.price : null,
    IsForSale: item.isForSale,
    IsPublicDomain: false,
    IsLimited: false,
    IsLimitedUnique: false,
  };
}

const toDetailsEntry = (item) => ({
  ...item,
  assetType: item.assetType,
  creatorTargetId: (item.creator && item.creator.id) || 1,
  creatorType: (item.creator && item.creator.type) || 'User',
  creatorName: (item.creator && item.creator.name) || 'EconomySim Games',
  createdAt: item.created || new Date(2016, 5, 1).toISOString(),
  updatedAt: item.updated || item.created || new Date(2016, 5, 1).toISOString(),
  genres: item.genres || [],
  favoriteCount: item.favoritedCount || 0,
  saleCount: item.sales || 0,
  isForSale: item.isForSale !== false,
  price: item.price !== undefined ? item.price : null,
  priceTickets: item.priceTickets !== undefined ? item.priceTickets : null,
  itemRestrictions: item.isLimitedUnique ? ['LimitedUnique'] : item.isLimited ? ['Limited'] : [],
  productId: item.productId || item.id,
  itemType: 'Asset',
  lowestSellerData: null,
  offsaleDeadline: null,
  currency: item.priceType === 'Tickets' ? 2 : 1,
});

export const getItemDetails = async (assetIdArray) => {
  if (assetIdArray.length === 0) return { data: { data: [] } };
  const wanted = assetIdArray.map(Number);
  const all = (await fetchCatalogItems()).concat(await fetchGames());
  const data = wanted.map(id => all.find(v => v.id === id)).filter(Boolean).map(toDetailsEntry);
  return { data: { data } };
}

export const getRecommendations = ({ assetId, assetTypeId, limit }) => {
  return fetchCatalogItems().then(items => ({
    data: items.filter(v => v.id !== Number(assetId)).slice(0, Number(limit) || 6),
  }));
}

export const getComments = async ({ assetId, offset }) => {
  return { data: { data: [], totalRows: 0 } };
}

export const createComment = async ({ assetId, comment }) => {
  return {};
}

export const addOrRemoveFromCollections = ({ assetId, addToProfile }) => {
  return Promise.resolve();
}

export const getIsFavorited = async ({ assetId, userId }) => {
  return false;
}

export const createFavorite = async ({ assetId, userId }) => {
  return {};
}

export const deleteFavorite = async ({ assetId, userId }) => {
  return {};
}
