// db-push — apply all Supabase SQL (schema, RPCs, migrations) to the
// remote database in one command, in dependency order. Everything in
// supabase/ is written to be idempotent, so this is safe to re-run; new
// migrations just get picked up the next time you run it.
//
// Usage:
//   npm run db:push
//
// Two transports (it picks whichever is configured, preferring the API):
//
//   1. Management API over HTTPS  ← works even on networks that block
//      database ports (campus/corporate WiFi). Put a personal access
//      token in mobile/.env.local (gitignored):
//        SUPABASE_ACCESS_TOKEN=sbp_...
//      Create one at https://supabase.com/dashboard/account/tokens
//      The project ref is read from EXPO_PUBLIC_SUPABASE_URL.
//
//   2. Direct Postgres connection. Put a connection string in
//      mobile/.env.local:
//        SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres
//      (Project Settings → Database → Connection string → URI. Requires
//      outbound port 5432, which some networks block.)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sqlDir = resolve(scriptDir, '..', '..', 'supabase');
const envPath = resolve(scriptDir, '..', '.env.local');

// Order matters: schema first, then base RPCs, then migrations (each of
// which builds on the previous). Seed/test data files are intentionally
// excluded — they're not part of the schema.
const ORDER = [
  'schema.sql',
  'create_pin_rpc.sql',
  'update_pin_rpc.sql',
  'list_pins_rpc.sql',
  'list_pins_with_user_id.sql',
  'playlist_rpcs.sql',
  'friend_rpcs.sql',
  'friend_activity_rpc.sql',
  'storage_bucket_setup.sql',
  'preview_url_migration.sql',
  'album_image_url_migration.sql',
  'user_images_migration.sql',
  'username_migration.sql',
  'pin_description_migration.sql',
  'delete_account_rpc.sql',
];

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      if (trimmed.slice(0, eq).trim() === key) {
        return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No .env.local — fall through to the error below.
  }
  return undefined;
}

// Some functions changed their RETURN shape across the SQL files, and
// Postgres refuses `CREATE OR REPLACE` when the return type differs from
// an existing same-signature function (you must DROP first). The newer
// files DROP first; the older ones use bare CREATE OR REPLACE. Rather
// than hand-edit each file, we auto-detect when a file (re)defines one
// of these fixed-signature functions and prepend a DROP IF EXISTS — so
// the CREATE always lands cleanly. The file then immediately recreates
// it, so nothing is left dropped. (create_pin/update_pin are overloaded
// by argument count, so they never hit this and aren't listed.)
const SHAPESHIFTERS = [
  ['list_pins', 'public.list_pins()'],
  ['list_playlists', 'public.list_playlists()'],
  ['list_playlist_pins', 'public.list_playlist_pins(uuid)'],
  ['search_users', 'public.search_users(text)'],
  ['list_friend_summary', 'public.list_friend_summary()'],
];

function withDrops(sql) {
  const drops = [];
  for (const [name, sig] of SHAPESHIFTERS) {
    if (new RegExp(`FUNCTION\\s+public\\.${name}\\s*\\(`, 'i').test(sql)) {
      drops.push(`DROP FUNCTION IF EXISTS ${sig};`);
    }
  }
  return drops.length ? `${drops.join('\n')}\n${sql}` : sql;
}

// --- Transport 1: Supabase Management API (HTTPS, port 443) ---------

function projectRef() {
  const url = loadEnvValue('EXPO_PUBLIC_SUPABASE_URL') || '';
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : undefined;
}

async function applyViaApi(token) {
  const ref = projectRef();
  if (!ref) {
    throw new Error(
      'Could not read the project ref from EXPO_PUBLIC_SUPABASE_URL in .env.local.',
    );
  }
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;
  console.log(`Applying via Management API (project ${ref}):\n`);

  for (const file of ORDER) {
    const query = withDrops(readFileSync(resolve(sqlDir, file), 'utf8'));
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`\n✗ Failed on ${file} (HTTP ${res.status}):\n  ${body}\n`);
      process.exit(1);
    }
    console.log(`  ✓ ${file}`);
  }
}

// --- Transport 2: direct Postgres connection (port 5432) ------------

async function applyViaPg(connectionString) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  console.log('Connecting to the database…');
  await client.connect();
  console.log('Connected. Applying SQL files:\n');

  for (const file of ORDER) {
    const sql = withDrops(readFileSync(resolve(sqlDir, file), 'utf8'));
    try {
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`\n✗ Failed on ${file}:\n  ${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }
  await client.end();
}

async function main() {
  const token = loadEnvValue('SUPABASE_ACCESS_TOKEN');
  const connectionString = loadEnvValue('SUPABASE_DB_URL');

  if (token) {
    // Prefer the API — works even where DB ports are firewalled.
    await applyViaApi(token);
  } else if (connectionString) {
    await applyViaPg(connectionString);
  } else {
    console.error(
      '\n✗ No credentials found. Add ONE of these to mobile/.env.local:\n\n' +
        '  • SUPABASE_ACCESS_TOKEN=sbp_...   (recommended — works over HTTPS)\n' +
        '      Create at https://supabase.com/dashboard/account/tokens\n\n' +
        '  • SUPABASE_DB_URL=postgresql://...:5432/postgres   (needs port 5432 open)\n',
    );
    process.exit(1);
  }

  console.log('\n✓ Database is up to date.');
}

main().catch((err) => {
  console.error('\n✗ Unexpected error:', err.message || err);
  process.exit(1);
});
