import request, { getBaseUrl } from "../lib/request"
import { getFullUrl } from "../lib/request";
import axios from "axios";

const baseUrl = getFullUrl('users', '');

export const getMyInfo = () => {
  // Prefer the local session (Supabase-backed login). If there is none but a
  // legacy .ROBLOSECURITY cookie login was used, fall back to the backend.
  return axios.get('/api/auth/me').then(d => d.data).catch(err => {
    const status = err.response && err.response.status;
    const hasLegacySession = typeof document !== 'undefined' && document.cookie.indexOf('has_legacy_session=1') !== -1;
    if (status === 401 && hasLegacySession) {
      return request('GET', baseUrl + '/v1/users/authenticated').then(d => d.data);
    }
    throw err;
  });
}

export const getUserInfo = ({ userId }) => {
  // Local Supabase-backed user profile (same shape as the users API).
  return axios.get('/api/web/users/' + userId).then(d => d.data.data);
}

export const getUserStatus = ({ userId }) => {
  return Promise.resolve({ status: '' });
}

export const updateStatus = ({ newStatus, userId }) => {
  return Promise.resolve({ status: newStatus });
}

export const getPreviousUsernames = async ({ userId }) => {
  return [];
}

export const searchUsers = async ({keyword, limit, offset}) => {
  // Local Supabase-backed user search (legacy search shape the UI expects).
  const d = await axios.get('/api/web/users?keyword=' + encodeURIComponent(keyword || '') + '&limit=' + limit + '&offset=' + offset).then(r => r.data);
  return {
    UserSearchResults: (d.data || []).map(v => ({
      UserId: v.id,
      Name: v.name,
      UserProfilePageUrl: '/users/' + v.id + '/profile',
    })),
    TotalResults: d.total || 0,
  };
}

export const getMembershipType = async ({userId}) => {
  return 0;
}

export const getUserIdByUsername = async (username) => {
  let result = await request('POST', getFullUrl('users', `/v1/usernames/users`), {
    usernames: [username],
  });
  if (!result.data.data.length)
    throw new Error('Invalid username');
  return result.data.data[0].id;
}
