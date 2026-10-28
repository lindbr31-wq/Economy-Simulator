import { createUser, findUserByUsername } from '../../../lib/server/db';
import { hashPassword } from '../../../lib/server/password';
import { setSessionCookie, signSession } from '../../../lib/server/session';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

const fail = (res, status, message) =>
  res.status(status).json({ success: false, errors: [{ message }] });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return fail(res, 405, 'Method not allowed');
  }
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return fail(res, 400, 'Username must be 3-20 characters and use only letters, numbers, or underscores.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return fail(res, 400, 'Password must be at least 8 characters.');
  }

  const name = username.trim();
  try {
    const existing = await findUserByUsername(name);
    if (existing) {
      return fail(res, 409, 'That username is already taken.');
    }
    const passwordHash = await hashPassword(password);
    const user = await createUser(name, passwordHash);
    setSessionCookie(res, signSession(user));
    return res.status(200).json({ success: true, id: user.id, name: user.username });
  } catch (e) {
    if (e && e.code === '23505') {
      return fail(res, 409, 'That username is already taken.');
    }
    console.error('[auth] register error', e);
    return fail(res, 500, 'Something went wrong creating your account. Please try again.');
  }
}
