import { getUserAvatarConfig } from '../../../../../lib/server/web';
import { renderUserAvatarSvg } from '../../../../../lib/server/svg';

// GET /api/web/users/[id]/image?type=headshot|avatar - the user's avatar as SVG.
// Designed to be used directly in <img> tags across the 2016 UI.
export default async function handler(req, res) {
  try {
    const config = await getUserAvatarConfig(Number(req.query.id));
    const full = req.query.type !== 'headshot';
    const svg = renderUserAvatarSvg(config, { full });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).send(svg);
  } catch (e) {
    console.error('[web] avatar image error', e);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  }
}
