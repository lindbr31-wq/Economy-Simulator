import { getUserPublic, getUserAvatarConfig } from '../../../../../lib/server/web';

// GET /api/web/users/[id] - public profile info + avatar config
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getUserPublic(Number(req.query.id));
    if (!user) return res.status(404).json({ errors: [{ message: 'User not found' }] });
    const avatar = await getUserAvatarConfig(user.id);
    const { online_at, ...rest } = user;
    return res.status(200).json({ data: { ...rest, avatar } });
  } catch (e) {
    console.error('[web] user info error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
