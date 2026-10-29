import { chunk, flatten } from "lodash";
import request, { getBaseUrl, getFullUrl } from "../lib/request"

const toCsv = (str) => {
  if (typeof str === 'string') return str;
  return encodeURIComponent(str.join(','));
}

const addBaseUrl = (arrayOfThumbs) => {
  return arrayOfThumbs.map(v => {
    if (typeof v.imageUrl === 'string' && !v.imageUrl.startsWith('http')) {
      v.imageUrl = getBaseUrl() + v.imageUrl;
    }
    return v;
  })
}

export const multiGetUserThumbnails = ({ userIds, size = '420x420', format = 'png' }) => {
  // Local avatar images rendered server-side as SVG (full body).
  const ids = [...new Set(userIds.map(v => parseInt(v, 10)))].filter(v => Number.isInteger(v));
  return Promise.resolve(ids.map(id => ({
    targetId: id,
    state: 'Completed',
    imageUrl: '/api/web/users/' + id + '/image?type=avatar',
  })));
}

let _multiGetHeadshotsMeta = {
  locked: false,
  cache: {},
  pending: [],
  onFinish: [],
  didRun: false,
  timer: 0,
}

export const multiGetUserHeadshots = ({ userIds, size = '420x420', format = 'png' }) => {
  // Local avatar headshots rendered server-side as SVG.
  const ids = [...new Set(userIds.map(v => parseInt(v, 10)))].filter(v => Number.isInteger(v));
  return Promise.resolve(ids.map(id => ({
    targetId: id,
    state: 'Completed',
    imageUrl: '/api/web/users/' + id + '/image?type=headshot',
  })));
}

export const multiGetOutfitThumbnails = ({ userOutfitIds, size = '420x420', format = 'png' }) => {
  return request('GET', getFullUrl('thumbnails', `/v1/users/outfits?userOutfitIds=${toCsv(userOutfitIds)}&size=${size}&format=${format}`)).then(d => d.data.data);
}

export const multiGetGroupIcons = ({ groupIds }) => {
  return request('get', getFullUrl('thumbnails', `/v1/groups/icons?groupIds=${toCsv(groupIds)}&format=png&size=420x420`)).then(d => d.data.data).then(addBaseUrl);
}

export const multiGetAssetThumbnails = ({ assetIds }) => {
  // Local catalog item icons rendered server-side as SVG.
  const ids = [...new Set((assetIds || []).map(v => parseInt(v, 10)))].filter(v => Number.isInteger(v));
  return Promise.resolve(ids.map(id => ({
    targetId: id,
    state: 'Completed',
    imageUrl: '/api/web/items/' + id + '/icon',
  })));
}

export const multiGetUniverseIcons = ({ universeIds, size }) => {
  // Local game thumbnails rendered server-side as SVG.
  const ids = [...new Set((universeIds || []).map(v => parseInt(v, 10)))].filter(v => Number.isInteger(v));
  return Promise.resolve(ids.map(id => ({
    targetId: id,
    state: 'Completed',
    imageUrl: '/api/web/games/' + id + '/icon',
  })));
}