import { listFriends, countUsers } from '../../../lib/server/web';

// GET /api/web/friends[?userId=] - every user on the site is your friend.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const userId = Number(req.query.userId) || 0;
    const data = await listFriends(userId);
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json({ data, total: await countUsers() });
  } catch (e) {
    console.error('[web] friends error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
