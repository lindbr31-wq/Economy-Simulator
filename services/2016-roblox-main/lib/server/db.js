// Shared Postgres pool for the serverless auth API routes.
// Point SUPABASE_DB_URL at the Supabase connection string (use the pooler,
// port 6543, for serverless), e.g.
//   postgres://econ_web:<password>@db.<ref>.supabase.co:6543/postgres
import { Pool } from 'pg';

let pool = null;

export const getPool = () => {
  if (pool) return pool;
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is not configured');
  }
  pool = new Pool({
    connectionString,
    max: 1,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  });
  return pool;
};

export const query = (text, params) => getPool().query(text, params);

// The schema's users table is called "user" (a reserved word) - always quote it.
export const findUserByUsername = async (username) => {
  const result = await query(
    'SELECT id, username, password, status, session_key FROM "user" WHERE lower(username) = lower($1) LIMIT 1',
    [username],
  );
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await query(
    'SELECT id, username, status, session_key FROM "user" WHERE id = $1 LIMIT 1',
    [id],
  );
  return result.rows[0] || null;
};

export const createUser = async (username, passwordHash) => {
  const result = await query(
    'INSERT INTO "user" (username, password, status) VALUES ($1, $2, 1) RETURNING id, username, status, session_key',
    [username, passwordHash],
  );
  return result.rows[0];
};

export const touchOnline = async (id) => {
  await query('UPDATE "user" SET online_at = now() WHERE id = $1', [id]);
};
