// Builds supabase/schema.sql: every migration, then the starter data, then the
// owner line, in one file to paste into the Supabase SQL Editor.
// The migrations in supabase/migrations/ stay the single source of truth:
//   npm run db:bundle      (regenerate after adding or changing a migration)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').trim();

const migrations = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();

const PLACEHOLDER = 'YOUR-EMAIL-HERE@example.com';

function build(email) {
  const header = email
    ? `-- PERSONAL FILE (not committed): paste all of it in the Supabase dashboard
-- (SQL Editor > New query > Run). The owner is ${email}: create your account with
-- exactly that email in Authentication > Users. Safe to run more than once.`
    : `-- GENERATED FILE: do not edit. Built by "npm run db:bundle" from supabase/migrations/,
-- supabase/seed.sql and supabase/owner.example.sql.
--
-- Paste all of it in the Supabase dashboard (SQL Editor > New query > Run) when you
-- are not using the Supabase command line. Before running, replace
-- ${PLACEHOLDER} at the very bottom with the email of the account
-- you created in Authentication > Users. Safe to run more than once.`;
  const parts = [
    header,
    ...migrations.map((m) => `-- ══ migration: ${m} ${'═'.repeat(Math.max(4, 60 - m.length))}\n\n${read('migrations/' + m)}`),
    `-- ══ starter data (seed.sql) ${'═'.repeat(38)}\n\n${read('seed.sql')}`,
    `-- ══ the owner${email ? '' : ': EDIT THE EMAIL'} ${'═'.repeat(36)}\n\ninsert into public.site_owners (email) values ('${email || PLACEHOLDER}')\non conflict do nothing;`,
  ];
  return parts.join('\n\n') + '\n';
}

fs.writeFileSync(path.join(root, 'schema.sql'), build(null));
console.log(`supabase/schema.sql written (${migrations.length} migration${migrations.length > 1 ? 's' : ''} + seed + owner line)`);

// OWNER_EMAIL=you@example.com npm run db:bundle  ->  also writes schema.mine.sql with your
// address filled in. That file is git-ignored, so your email never ends up in the repository.
const email = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
if (email) {
  if (!/^[^\s@'";]+@[^\s@'";]+\.[^\s@'";]+$/.test(email)) throw new Error('OWNER_EMAIL does not look like an email address');
  fs.writeFileSync(path.join(root, 'schema.mine.sql'), build(email));
  console.log('supabase/schema.mine.sql written for ' + email + ' (git-ignored)');
}
