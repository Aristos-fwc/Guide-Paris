// Turn a thrown error into a sentence a visitor can act on.
export function friendly(e) {
  const m = (e && e.message) || '';
  if (/row-level security|permission denied|not authorized|jwt/i.test(m)) {
    return 'You cannot do that. Log in, and note that you can only change what you created.';
  }
  if (/column .* does not exist|could not find the .* column|schema cache/i.test(m)) {
    return 'The database is out of date. Apply the latest migration (npx supabase db push), or run supabase/schema.sql in the Supabase SQL Editor.';
  }
  return m || 'Something went wrong. Please try again.';
}
