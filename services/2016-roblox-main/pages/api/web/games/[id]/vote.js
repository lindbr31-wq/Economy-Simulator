import { getGame, voteGame, getSessionUser } from '../../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ errors: [{ message: 'Not logged in' }] });
    const id = Number(req.query.id);
    const game = await getGame(id);
    if (!game) return res.status(404).json({ errors: [{ message: 'Game not found' }] });
    const vote = req.body && req.body.vote === -1 ? -1 : req.body && req.body.vote === 1 ? 1 : 0;
    const result = await voteGame(id, user.id, vote);
    return res.status(200).json({ data: result });
  } catch (e) {
    console.error('[web] vote error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
