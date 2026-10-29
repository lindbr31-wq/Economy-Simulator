import { getPresence } from '../../../lib/server/web';

// POST /api/web/presence {userIds} -> presence list (2016 presence API shape)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const userPresences = await getPresence((req.body && req.body.userIds) || []);
    return res.status(200).json({ userPresences });
  } catch (e) {
    console.error('[web] presence error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
