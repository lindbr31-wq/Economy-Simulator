import { getGame, submitScore, clampScore, getSessionUser, getTopScores } from '../../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const id = Number(req.query.id);
      const game = await getGame(id);
      if (!game) return res.status(404).json({ errors: [{ message: 'Game not found' }] });
      const rows = await getTopScores(id, 10);
      return res.status(200).json({
        data: rows.map(r => ({ username: r.username, score: Number(r.score) })),
      });
    } catch (e) {
      console.error('[web] score list error', e);
      return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ errors: [{ message: 'Not logged in' }] });
    const id = Number(req.query.id);
    const game = await getGame(id);
    if (!game) return res.status(404).json({ errors: [{ message: 'Game not found' }] });
    const score = clampScore(req.body && req.body.score);
    if (score === null) return res.status(400).json({ errors: [{ message: 'Invalid score' }] });
    const best = await submitScore(id, user.id, user.username, score);
    return res.status(200).json({ data: { score, best } });
  } catch (e) {
    console.error('[web] score submit error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
