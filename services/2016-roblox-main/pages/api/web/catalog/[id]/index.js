import { getItem, getSessionUser, getOwnedItems } from '../../../../../lib/server/web';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const item = await getItem(Number(req.query.id));
    if (!item) return res.status(404).json({ errors: [{ message: 'Item not found' }] });
    const user = await getSessionUser(req);
    let owned = false;
    if (user) {
      const ownedItems = await getOwnedItems(user.id);
      owned = ownedItems.some((o) => o.id === item.id);
    }
    return res.status(200).json({ data: { item, owned } });
  } catch (e) {
    console.error('[web] item detail error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
