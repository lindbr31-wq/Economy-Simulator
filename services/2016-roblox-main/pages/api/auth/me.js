import { findUserById } from '../../../lib/server/db';
import { getSessionFromRequest } from '../../../lib/server/session';

const fail = (res, status, message) =>
  res.status(status).json({ success: false, errors: [{ message }] });

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return fail(res, 401, 'Not logged in');
  }
  try {
    const user = await findUserById(session.id);
    // Invalidate tokens whose session key no longer matches (bumped on
    // password changes / logout-everywhere) and disabled accounts.
    if (!user || user.status !== 1 || (user.session_key || 0) !== session.sessionKey) {
      return fail(res, 401, 'Not logged in');
    }
    return res.status(200).json({
      id: user.id,
      name: user.username,
      username: user.username,
      isStaff: false,
    });
  } catch (e) {
    console.error('[auth] me error', e);
    return fail(res, 500, 'Something went wrong');
  }
}
