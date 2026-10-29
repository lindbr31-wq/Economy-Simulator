import { getItem } from '../../../../../lib/server/web';
import { renderItemSvg } from '../../../../../lib/server/svg';

// GET /api/web/items/[id]/icon - catalog item art as SVG for <img> tags.
export default async function handler(req, res) {
  try {
    const item = await getItem(Number(req.query.id));
    const svg = renderItemSvg(item || { id: Number(req.query.id) });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(svg);
  } catch (e) {
    console.error('[web] item icon error', e);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  }
}
