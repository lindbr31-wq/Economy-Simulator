import { buyItem, getItem, ensureWebUser, getSessionUser } from '../../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ errors: [{ message: 'Not logged in' }] });
    const id = Number(req.query.id);
    const item = await getItem(id);
    if (!item) return res.status(404).json({ errors: [{ message: 'Item not found' }] });
    await ensureWebUser(user.id);
    const result = await buyItem(user.id, id);
    if (result.owned) return res.status(409).json({ errors: [{ message: 'You already own this item' }] });
    if (result.error === 'insufficient') {
      return res.status(402).json({ errors: [{ message: 'Not enough currency for this item' }] });
    }
    return res.status(200).json({ data: { purchased: true, item: { id: item.id, name: item.name, price: item.price, currency: item.currency } } });
  } catch (e) {
    console.error('[web] buy error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
