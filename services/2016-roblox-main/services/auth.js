import request from "../lib/request"
import { getFullUrl } from "../lib/request";
import axios from "axios";

// Local (Supabase-backed) auth: username + password login sets an HttpOnly
// session cookie - no .ROBLOSECURITY cookie required.
export const login = ({ username, password }) => {
  return axios.post('/api/auth/login', { username, password }).then(d => d.data);
}

export const register = ({ username, password }) => {
  return axios.post('/api/auth/register', { username, password }).then(d => d.data);
}

export const logout = () => {
  return axios.post('/api/auth/logout', {}).then(d => d.data);
}

export const changePassword = ({ existingPassword, newPassword }) => {
  return request('POST', getFullUrl('auth', `/v2/user/passwords/change`), {
    currentPassword: existingPassword,
    newPassword,
  });
}

export const validateUsername = ({ username, context }) => {
  return request('GET', getFullUrl('auth', `/v1/usernames/validate?username=${encodeURIComponent(username)}&context=${encodeURIComponent(context)}`)).then(d => d.data)
}

export const changeUsername = ({ username, password }) => {
  return request('POST', getFullUrl('auth', `/v1/username`), {
    username,
    password,
  })
}

export const logoutFromAllOtherSessions = () => {
  return request('POST', getFullUrl('auth', '/v2/logoutfromallsessionsandreauthenticate'))
}