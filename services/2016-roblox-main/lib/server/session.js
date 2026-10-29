// JWT session helpers for local (Supabase-backed) authentication.
// Sessions are independent of .ROBLOSECURITY: logging in with username+password
// issues an HttpOnly ECON_SESSION cookie instead of requiring a backend cookie.
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'ECON_SESSION';
const SESSION_DAYS = 30;

const sessionSecret = () => {
  const secret = process.env.SESSION_KEY || process.env.CSRF_KEY;
  if (!secret) {
    throw new Error('SESSION_KEY (or CSRF_KEY) must be configured to use local auth');
  }
  return secret;
};

export const signSession = (user) => {
  return jwt.sign(
    {
      sub: String(user.id),
      name: user.username,
      sk: user.session_key || 0,
    },
    sessionSecret(),
    { expiresIn: `${SESSION_DAYS}d` },
  );
};

export const verifySession = (token) => {
  const decoded = jwt.verify(token, sessionSecret());
  if (!decoded || !decoded.sub) return null;
  return {
    id: decoded.sub,
    username: decoded.name,
    sessionKey: decoded.sk || 0,
  };
};

export const setSessionCookie = (res, token) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Max-Age=${86400 * SESSION_DAYS}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
};

export const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
};

export const getSessionFromRequest = (req) => {
  const header = req.headers.cookie || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    return verifySession(match[1]);
  } catch (e) {
    return null;
  }
};
