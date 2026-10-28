// Diagnostic endpoint: reports whether the configured database is reachable.
//   GET /api/auth/health
//     -> { success: true, db: "ok" } or { success: false, db: "error", message }
//   GET /api/auth/health?token=<SESSION_KEY>&probe=<base64url(SUPABASE_DB_URL)>
//     -> tests an arbitrary connection string instead of the configured one
//        (same shape). Gated by SESSION_KEY and *.supabase.com host allowlist;
//        used to verify Supavisor pooler routing without a redeploy.
import { Pool } from 'pg';

export default async function handler(req, res) {
  try {
    let connectionString = process.env.SUPABASE_DB_URL;

    if (req.query.probe) {
      const token = String(req.query.token || '');
      if (!process.env.SESSION_KEY || token !== process.env.SESSION_KEY) {
        return res.status(404).json({ errors: [{ message: 'Not found' }] });
      }
      let probeUrl = '';
      try {
        probeUrl = Buffer.from(String(req.query.probe), 'base64url').toString('utf8');
        const parsed = new URL(probeUrl);
        if (!/(^|\.)supabase\.com$/i.test(parsed.hostname)) {
          throw new Error('host not allowed');
        }
      } catch {
        return res.status(400).json({ errors: [{ message: 'Invalid probe URL' }] });
      }
      connectionString = probeUrl;
    }

    if (!connectionString) {
      return res.status(500).json({ success: false, db: 'error', message: 'SUPABASE_DB_URL is not set' });
    }

    const pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await pool.query('SELECT 1');
      return res.status(200).json({ success: true, db: 'ok' });
    } catch (err) {
      return res.status(200).json({ success: false, db: 'error', message: err.message });
    } finally {
      await pool.end().catch(() => {});
    }
  } catch (err) {
    return res.status(200).json({ success: false, db: 'error', message: err.message });
  }
}
