import { clearSessionCookie } from '../../../lib/server/session';

export default async function handler(req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
