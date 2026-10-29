import { listItems } from '../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const items = await listItems({
      category: typeof req.query.category === 'string' ? req.query.category : 'all',
      q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 64) : '',
    });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ data: items });
  } catch (e) {
    console.error('[web] catalog list error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
