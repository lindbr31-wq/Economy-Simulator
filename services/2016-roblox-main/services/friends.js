import axios from "axios";

// Friends for the self-contained site: every user on the site is your friend.
// These keep the shapes the 2016 UI components expect, backed by /api/web.

const allFriends = ({ userId } = {}) =>
  axios.get('/api/web/friends' + (userId ? '?userId=' + userId : '')).then(d => d.data);

export const getFriends = ({ userId }) => {
  return allFriends({ userId }).then(d => d.data);
}

/**
 * Get friend request count for the authenticated user
 * @returns {Promise<number>}
 */
export const getFriendRequestCount = () => {
  return Promise.resolve(0);
}

/**
 * @returns {Promise<number>}
 */
export const getFollowersCount = ({ userId }) => {
  return allFriends({ userId }).then(d => ({ count: d.total || 0 }));
}

export const getFollowers = ({ userId, cursor, limit, sort = 'Asc' }) => {
  return allFriends({ userId }).then(d => ({ data: d.data, nextPageCursor: null }));
}

/**
 * @returns {Promise<number>}
 */
export const getFollowingsCount = ({ userId }) => {
  return allFriends({ userId }).then(d => ({ count: d.total || 0 }));
}

export const getFollowings = ({ userId, cursor, limit, sort = 'Asc' }) => {
  return allFriends({ userId }).then(d => ({ data: d.data, nextPageCursor: null }));
}

/**@returns {Promise<string>} */
export const getFriendStatus = ({ authenticatedUserId, userId }) => {
  return Promise.resolve('Friends');
}

export const getFriendRequests = ({cursor, limit}) => {
  return Promise.resolve({ data: [], nextPageCursor: null });
}

export const unfriendUser = ({ userId }) => {
  return Promise.resolve(); // everyone stays friends on this site
}

export const acceptFriendRequest = ({ userId }) => {
  return Promise.resolve();
}

export const sendFriendRequest = ({ userId }) => {
  return Promise.resolve();
}

export const declineFriendRequest = ({ userId }) => {
  return Promise.resolve();
}

export const followUser = ({ userId }) => {
  return Promise.resolve();
}

export const unfollowUser = ({ userId }) => {
  return Promise.resolve();
}

export const isAuthenticatedUserFollowingUserId = ({ userId }) => {
  return Promise.resolve(true);
}
