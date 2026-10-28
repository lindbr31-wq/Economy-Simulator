import { getInventory, getSessionUser } from '../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ errors: [{ message: 'Not logged in' }] });
    const inv = await getInventory(user.id);
    return res.status(200).json({ data: { username: user.username, ...inv } });
  } catch (e) {
    console.error('[web] inventory error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
