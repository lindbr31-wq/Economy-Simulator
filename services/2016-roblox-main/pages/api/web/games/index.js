import { listGames } from '../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const games = await listGames();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ data: games });
  } catch (e) {
    console.error('[web] games list error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
