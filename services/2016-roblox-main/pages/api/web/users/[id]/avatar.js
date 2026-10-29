import { getUserAvatarConfig, getUserPublic, getEquippedItems } from '../../../../../lib/server/web';

// GET /api/web/users/[id]/avatar - avatar config + equipped items (for 3D viewer)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getUserPublic(Number(req.query.id));
    if (!user) return res.status(404).json({ errors: [{ message: 'User not found' }] });
    const config = await getUserAvatarConfig(user.id);
    const equipped = await getEquippedItems(user.id);
    return res.status(200).json({ data: { config, equipped, username: user.name } });
  } catch (e) {
    console.error('[web] user avatar error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
