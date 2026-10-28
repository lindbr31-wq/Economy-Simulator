import { getGame, recordPlay } from '../../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const id = Number(req.query.id);
    const game = await getGame(id);
    if (!game) return res.status(404).json({ errors: [{ message: 'Game not found' }] });
    await recordPlay(id);
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('[web] game play error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
