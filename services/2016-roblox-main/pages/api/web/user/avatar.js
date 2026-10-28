import { getSessionUser, getOwnedItems, saveAvatar, validateAvatarConfig } from '../../../../lib/server/web';
import { DEFAULT_AVATAR } from '../../../../lib/catalogItems';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ errors: [{ message: 'Not logged in' }] });
    const owned = await getOwnedItems(user.id);
    // Users may not have purchased the starter face in local/new accounts;
    // the default avatar's face is always allowed.
    const allowed = owned.some((o) => o.id === DEFAULT_AVATAR.faceId)
      ? owned
      : [...owned, { id: DEFAULT_AVATAR.faceId, category: 'faces' }];
    const result = validateAvatarConfig(req.body && req.body.config, allowed);
    if (!result.ok) return res.status(400).json({ errors: [{ message: result.error }] });
    await saveAvatar(user.id, result.config);
    return res.status(200).json({ data: { saved: true, config: result.config } });
  } catch (e) {
    console.error('[web] avatar save error', e);
    return res.status(500).json({ errors: [{ message: 'Something went wrong' }] });
  }
}
