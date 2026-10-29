import { getInventory, getSessionUser } from '../../../lib/server/web';

// GET /api/web/economy - the logged-in user's wallet (feeds the navbar counters).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ errors: [{ message: 'Not logged in' }] });
    const inv = await getInventory(user.id);
    return res.status(200).json({ robux: inv.wallet.robux, tickets: inv.wallet.tix });
  } catch (e) {
    console.error('[web] economy error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
