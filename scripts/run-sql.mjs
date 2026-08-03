// Run a .sql file against the Supabase database directly.
//   node scripts/run-sql.mjs supabase/some.sql
// Needs SUPABASE_DB_URL in .env.local (Supabase → Settings → Database →
// Connection string). Lets us apply schema/migrations without the SQL Editor.
import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const url = env.SUPABASE_DB_URL;
if (!url) { console.error('Missing SUPABASE_DB_URL in .env.local'); process.exit(1); }

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/run-sql.mjs <file.sql>'); process.exit(1); }
const sql = fs.readFileSync(file, 'utf8');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log(`✅ applied ${file}`);
} catch (e) {
  console.error(`❌ ${file}:`, e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
