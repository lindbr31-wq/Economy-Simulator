import { getGame, getTopScores, getMyScore, getMyVote, getSessionUser } from '../../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const id = Number(req.query.id);
    const game = await getGame(id);
    if (!game) return res.status(404).json({ errors: [{ message: 'Game not found' }] });
    const user = await getSessionUser(req);
    const [scores, myBest, myVote] = await Promise.all([
      getTopScores(id, 10),
      user ? getMyScore(id, user.id) : Promise.resolve(null),
      user ? getMyVote(id, user.id) : Promise.resolve(0),
    ]);
    return res.status(200).json({ data: { game, scores, myBest, myVote } });
  } catch (e) {
    console.error('[web] game detail error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
