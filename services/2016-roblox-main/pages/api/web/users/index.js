import { listUsers, getUserPublic, countUsers } from '../../../../lib/server/web';

// GET /api/web/users?keyword=&limit=  -> user search
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim().slice(0, 64) : '';
    const limit = Math.min(25, Number(req.query.limit) || 12);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const data = await listUsers({ keyword, limit, offset });
    const total = await countUsers(keyword);
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json({ data, total });
  } catch (e) {
    console.error('[web] users search error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
