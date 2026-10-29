import { getGame } from '../../../../../lib/server/web';
import { renderGameThumbSvg } from '../../../../../lib/server/svg';

// GET /api/web/games/[id]/icon - game thumbnail as SVG for <img> tags.
export default async function handler(req, res) {
  try {
    const game = await getGame(Number(req.query.id));
    const svg = renderGameThumbSvg(game || {});
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(svg);
  } catch (e) {
    console.error('[web] game icon error', e);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  }
}
