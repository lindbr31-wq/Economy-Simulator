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
  return request('GET', getFullUrl('games', `/v2/games/${universeId}/media`)).then(d => d.data.data);
}

export const launchGame = async ({ placeId }) => {
  const result = await request('GET', getBaseUrl() + '/game/get-join-script?placeId=' + encodeURIComponent(placeId));
  const toClick = result.data.joinUrl;
  const aTag = document.createElement('a');
  aTag.setAttribute('href', result.data.prefix + '' + result.data.joinScriptUrl);
  document.body.appendChild(aTag);
  aTag.click();
  // delay before deletion is required on some browsers, not sure why
  setTimeout(() => {
    aTag.remove();
  }, 1000);
}

export const multiGetPlaceDetails = ({ placeIds }) => {
  return request('GET', getFullUrl('games', `/v1/games/multiget-place-details?placeIds=${encodeURIComponent(placeIds.join(','))}`)).then(d => d.data);
}

export const multiGetUniverseDetails = ({ universeIds }) => {
  return request('GET', getFullUrl('games', `/v1/games?universeIds=${encodeURIComponent(universeIds.join(','))}`)).then(d => d.data.data);
}

export const getServers = ({ placeId, offset }) => {
  return request('GET', getBaseUrl() + `/games/getgameinstancesjson?placeId=${placeId}&startIndex=${offset}`).then(d => d.data);
}

export const multiGetGameVotes = ({universeIds}) => {
  return request('GET', getFullUrl('games', '/v1/games/votes?universeIds=' + encodeURIComponent(universeIds.join(',')))).then(d => d.data.data);
}

export const voteOnGame = ({universeId, isUpvote}) => {
  return request('PATCH', getFullUrl('games', '/v1/games/'+universeId+'/user-votes'), {
    vote: isUpvote,
  }).then(d => d.data.data);
}