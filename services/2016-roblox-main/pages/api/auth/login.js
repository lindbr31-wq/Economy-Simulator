import { findUserByUsername, touchOnline } from '../../../lib/server/db';
import { verifyPassword } from '../../../lib/server/password';
import { setSessionCookie, signSession } from '../../../lib/server/session';

const fail = (res, status, message) =>
  res.status(status).json({ success: false, errors: [{ message }] });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return fail(res, 405, 'Method not allowed');
  }
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return fail(res, 400, 'Username and password are required.');
  }

  try {
    const user = await findUserByUsername(username.trim());
    const ok = user && (await verifyPassword(user.password, password));
    if (!ok) {
      return fail(res, 403, 'Incorrect username or password.');
    }
    if (user.status !== 1) {
      return fail(res, 403, 'This account cannot log in.');
    }
    setSessionCookie(res, signSession(user));
    touchOnline(user.id).catch(() => {});
    return res.status(200).json({ success: true, id: user.id, name: user.username });
  } catch (e) {
    console.error('[auth] login error', e);
    return fail(res, 500, 'Something went wrong logging in. Please try again.');
  }
}
