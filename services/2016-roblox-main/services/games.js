import getFlag from "../lib/getFlag";
import request, { getBaseUrl, getFullUrl } from "../lib/request"
import { itemNameToEncodedName } from "./catalog";
const gamePage2015Enabled = getFlag('2015GameDetailsPageEnabled', false);
const csrEnabled = getFlag('clientSideRenderingEnabled', false);

export const getGameUrl = ({ placeId, name }) => {
  return `/games/${placeId}/${itemNameToEncodedName(name)}`;
}

export const getUserGames = ({ userId, cursor }) => {
  // No per-user game creation on the self-contained site (yet).
  return Promise.resolve({ data: [], nextPageCursor: null });
}

export const getGroupGames = ({ groupId, cursor }) => {
  return Promise.resolve({ data: [], nextPageCursor: null });
}

export const getGameSorts = ({ gameSortsContext }) => {
  return Promise.resolve({
    sorts: [
      { token: 'all', name: 'All', displayName: 'Featured Games' },
    ],
  });
}

const toGameRow = (g) => ({
  universeId: Number(g.id),
  placeId: Number(g.id),
  name: g.name,
  creatorId: 1,
  creatorName: g.creator || 'EconomySim Games',
  creatorType: 'User',
  playerCount: Math.max(1, Math.round(Number(g.plays || 0) / 250)),
  totalUpVotes: Number(g.likes || 0),
  totalDownVotes: Number(g.dislikes || 0),
});

export const getGameList = ({ sortToken, limit, genre = 0, keyword }) => {
  return request('GET', '/api/web/games').then(d => {
    const rows = (d.data.data || []).map(toGameRow);
    return { games: rows };
  });
}

export const getGameMedia = ({ universeId }) => {
  return Promise.resolve([]);
}

export const launchGame = async ({ placeId }) => {
  // Join flow is handled by the web player page (/RobloxApp/Play).
  window.location.href = '/RobloxApp/Play?placeId=' + placeId;
}

const toPlaceDetails = (row) => ({
  id: Number(row.id),
  name: row.name,
  description: row.description || '',
  builder: row.creator || 'EconomySim Games',
  builderId: 1,
  isPlayable: true,
  reasonProhibited: 'None',
  assetTypeId: 9,
});

const toUniverseDetails = (row) => ({
  id: Number(row.id),
  rootPlaceId: Number(row.id),
  name: row.name,
  description: row.description || '',
  creator: { id: 1, name: row.creator || 'EconomySim Games', type: 'User' },
  price: null,
  allowedGearGenres: [],
  playing: Math.max(1, Math.round(Number(row.plays || 0) / 250)),
  visits: Number(row.plays || 0),
  maxPlayers: 12,
  created: row.created_at || new Date(2016, 5, 1).toISOString(),
  updated: row.created_at || new Date(2016, 5, 1).toISOString(),
  genre: row.genre,
  isAllGenre: false,
  isFavoritedByUser: false,
});

const fetchGameRows = () =>
  request('GET', '/api/web/games').then(d => d.data.data || []);

export const multiGetPlaceDetails = ({ placeIds }) => {
  const ids = (placeIds || []).map(Number);
  return fetchGameRows().then(rows =>
    ids.map(id => rows.find(r => Number(r.id) === id)).filter(Boolean).map(toPlaceDetails)
  );
}

export const multiGetUniverseDetails = ({ universeIds }) => {
  const ids = (universeIds || []).map(Number);
  return fetchGameRows().then(rows =>
    ids.map(id => rows.find(r => Number(r.id) === id)).filter(Boolean).map(toUniverseDetails)
  );
}

export const getServers = ({ placeId, offset }) => {
  return Promise.resolve({ Collection: [], TotalCollectionSize: 0 });
}

export const multiGetGameVotes = ({universeIds}) => {
  const ids = (universeIds || []).map(Number);
  return fetchGameRows().then(rows =>
    ids.map(id => {
      const r = rows.find(x => Number(x.id) === id);
      return r ? { id: Number(r.id), upVotes: Number(r.likes || 0), downVotes: Number(r.dislikes || 0) } : null;
    }).filter(Boolean)
  );
}

export const voteOnGame = ({universeId, isUpvote}) => {
  return request('POST', '/api/web/games/' + universeId + '/vote', {
    vote: isUpvote ? 1 : -1,
  }).then(d => d.data.data || d.data);
}