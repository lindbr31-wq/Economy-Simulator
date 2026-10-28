import { query } from '../../../lib/server/db';

// Simple health check: verifies DB connectivity. Used for smoke tests.
export default async function handler(req, res) {
  try {
    await query('SELECT 1');
    return res.status(200).json({ success: true, db: 'ok' });
  } catch (e) {
    return res.status(500).json({ success: false, db: 'error', message: String(e.message || e) });
  }
}
