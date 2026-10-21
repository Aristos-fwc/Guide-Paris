-- GENERATED FILE: do not edit. Built by "npm run db:bundle" from supabase/migrations/,
-- supabase/seed.sql and supabase/owner.example.sql.
--
-- Paste all of it in the Supabase dashboard (SQL Editor > New query > Run) when you
-- are not using the Supabase command line. Before running, replace
-- YOUR-EMAIL-HERE@example.com at the very bottom with the email of the account
-- you created in Authentication > Users. Safe to run more than once.

-- ══ migration: 20261020120000_initial_schema.sql ═══════════════════════════

-- Paris Guide: initial database schema.
--
-- Objects: site_owners, categories, places, place_photos, guides, guide_places,
-- comments, and the photo storage bucket.
--
-- Access model
--   Everyone (the public key) can READ places, photos, categories, guides and
--   comments, and can POST comments.
--   Only the site owner can add / edit / delete places, photos, categories and
--   guides. "Owner" = a logged-in user whose email is listed in site_owners.
--   The rules are enforced by Postgres row-level security, not by the website.
--
-- Written to be re-runnable (if not exists / or replace / drop ... if exists),
-- so it is also safe to paste into the SQL Editor more than once.

-- ── Helpers ───────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── site_owners: who may edit ─────────────────────────────────────────────
-- Not readable through the API (row-level security, no policy). Add yourself
-- once: see supabase/owner.example.sql.
create table if not exists public.site_owners (
  email       text primary key,
  created_at  timestamptz not null default now()
);
alter table public.site_owners enable row level security;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_owners
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_owner() to anon, authenticated;

-- ── categories ────────────────────────────────────────────────────────────
-- The name is the key, so a place can reference it directly and renaming a
-- category updates every place that uses it.
create table if not exists public.categories (
  name        text primary key check (char_length(name) between 1 and 40),
  created_at  timestamptz not null default now()
);

-- ── places ────────────────────────────────────────────────────────────────
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  cat         text not null references public.categories (name) on update cascade on delete restrict,
  note        text not null default '' check (char_length(note) <= 1000),
  address     text check (address is null or char_length(address) <= 300),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists places_cat_idx on public.places (cat);

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at before update on public.places
  for each row execute function public.set_updated_at();

-- ── place_photos: any number of photos per place ──────────────────────────
-- The photo with the lowest position is the cover. A photo found on Wikimedia
-- Commons keeps its author/licence (credit) and a link to the original file.
create table if not exists public.place_photos (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  url         text not null check (char_length(url) between 1 and 500),
  credit      text check (credit is null or char_length(credit) <= 200),
  credit_url  text check (credit_url is null or char_length(credit_url) <= 500),
  source      text not null default 'upload' check (source in ('upload', 'wikimedia')),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (place_id, url)
);
create index if not exists place_photos_place_idx on public.place_photos (place_id, position);

-- ── guides and their places ───────────────────────────────────────────────
create table if not exists public.guides (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  summary     text check (summary is null or char_length(summary) <= 500),
  created_at  timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists guides_set_updated_at on public.guides;
create trigger guides_set_updated_at before update on public.guides
  for each row execute function public.set_updated_at();

-- Which places belong to which guide, and in what order. Deleting a guide or a
-- place removes its links automatically.
create table if not exists public.guide_places (
  guide_id    uuid not null references public.guides (id) on delete cascade,
  place_id    uuid not null references public.places (id) on delete cascade,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (guide_id, place_id)
);
create index if not exists guide_places_place_idx on public.guide_places (place_id);
create index if not exists guide_places_guide_pos_idx on public.guide_places (guide_id, position);

-- ── comments: the guestbook ───────────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  author      text not null check (char_length(author) between 1 and 40),
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists comments_created_idx on public.comments (created_at desc);

-- ── Row-level security ────────────────────────────────────────────────────
alter table public.categories   enable row level security;
alter table public.places       enable row level security;
alter table public.place_photos enable row level security;
alter table public.guides       enable row level security;
alter table public.guide_places enable row level security;
alter table public.comments     enable row level security;

-- categories: public read, owner write (renaming updates every place that uses
-- the category; deleting a category that is still in use is refused)
drop policy if exists "categories read"   on public.categories;
drop policy if exists "categories insert" on public.categories;
drop policy if exists "categories update" on public.categories;
drop policy if exists "categories delete" on public.categories;
create policy "categories read"   on public.categories for select to anon, authenticated using (true);
create policy "categories insert" on public.categories for insert to authenticated with check (public.is_owner());
create policy "categories update" on public.categories for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "categories delete" on public.categories for delete to authenticated using (public.is_owner());

-- places: public read, owner write
drop policy if exists "places read"   on public.places;
drop policy if exists "places insert" on public.places;
drop policy if exists "places update" on public.places;
drop policy if exists "places delete" on public.places;
create policy "places read"   on public.places for select to anon, authenticated using (true);
create policy "places insert" on public.places for insert to authenticated with check (public.is_owner());
create policy "places update" on public.places for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "places delete" on public.places for delete to authenticated using (public.is_owner());

-- place_photos: public read, owner write
drop policy if exists "place photos read"   on public.place_photos;
drop policy if exists "place photos insert" on public.place_photos;
drop policy if exists "place photos update" on public.place_photos;
drop policy if exists "place photos delete" on public.place_photos;
create policy "place photos read"   on public.place_photos for select to anon, authenticated using (true);
create policy "place photos insert" on public.place_photos for insert to authenticated with check (public.is_owner());
create policy "place photos update" on public.place_photos for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "place photos delete" on public.place_photos for delete to authenticated using (public.is_owner());

-- guides: public read, owner write
drop policy if exists "guides read"   on public.guides;
drop policy if exists "guides insert" on public.guides;
drop policy if exists "guides update" on public.guides;
drop policy if exists "guides delete" on public.guides;
create policy "guides read"   on public.guides for select to anon, authenticated using (true);
create policy "guides insert" on public.guides for insert to authenticated with check (public.is_owner());
create policy "guides update" on public.guides for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "guides delete" on public.guides for delete to authenticated using (public.is_owner());

-- guide_places: public read, owner write
drop policy if exists "guide places read"   on public.guide_places;
drop policy if exists "guide places insert" on public.guide_places;
drop policy if exists "guide places update" on public.guide_places;
drop policy if exists "guide places delete" on public.guide_places;
create policy "guide places read"   on public.guide_places for select to anon, authenticated using (true);
create policy "guide places insert" on public.guide_places for insert to authenticated with check (public.is_owner());
create policy "guide places update" on public.guide_places for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "guide places delete" on public.guide_places for delete to authenticated using (public.is_owner());

-- comments: public read and post; nobody edits or deletes through the API
-- (moderate from the dashboard: Table Editor > comments > delete a row)
drop policy if exists "comments read"   on public.comments;
drop policy if exists "comments insert" on public.comments;
create policy "comments read"   on public.comments for select to anon, authenticated using (true);
create policy "comments insert" on public.comments for insert to anon, authenticated with check (true);

-- ── Photo storage: public bucket, 1 MB max, images only ───────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "place images read"   on storage.objects;
drop policy if exists "place images insert" on storage.objects;
drop policy if exists "place images delete" on storage.objects;
create policy "place images read"   on storage.objects for select to anon, authenticated using (bucket_id = 'place-images');
create policy "place images insert" on storage.objects for insert to authenticated with check (bucket_id = 'place-images' and public.is_owner());
create policy "place images delete" on storage.objects for delete to authenticated using (bucket_id = 'place-images' and public.is_owner());

-- ══ migration: 20261020180000_user_guides.sql ══════════════════════════════

-- Any signed-in visitor can create their own guides and places.
--
-- Before: only the site owner (site_owners) could write anything.
-- Now: every place and guide records who created it (owner_id). Its creator can
-- edit and delete it, add or remove its photos, and (for a guide) manage which
-- places it contains. The site owner (the "admin", listed in site_owners) can
-- still edit and delete everything, which is how bad content is moderated.
-- Everything stays publicly readable. Categories stay owner-only, so the list
-- of categories remains tidy.
--
-- Rows that already exist keep owner_id null: only the admin can change those.
-- The database applies the rules (row-level security), not the website.
--
-- Written to be re-runnable.

-- ── Who created what ──────────────────────────────────────────────────────
-- The default fills owner_id from the logged-in user, so the website never has
-- to send it (and cannot send someone else's: the policies below check it).
alter table public.places add column if not exists owner_id uuid references auth.users (id) on delete set null default auth.uid();
alter table public.guides add column if not exists owner_id uuid references auth.users (id) on delete set null default auth.uid();
create index if not exists places_owner_idx on public.places (owner_id);
create index if not exists guides_owner_idx on public.guides (owner_id);

-- True for the admin, or for the user who created the row.
create or replace function public.can_manage(row_owner uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_owner() or (row_owner is not null and row_owner = auth.uid());
$$;
grant execute on function public.can_manage(uuid) to anon, authenticated;

-- ── Limits, so one account cannot flood the site ──────────────────────────
-- The admin is not limited. Raise the numbers here if they get in the way.
create or replace function public.enforce_user_quota()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  used integer;
  max_rows integer := case tg_table_name when 'guides' then 20 else 100 end;
begin
  if public.is_owner() then
    return new;
  end if;
  execute format('select count(*) from public.%I where owner_id = $1', tg_table_name) into used using auth.uid();
  if used >= max_rows then
    raise exception 'Limit reached: at most % % per account.', max_rows, tg_table_name using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists places_quota on public.places;
create trigger places_quota before insert on public.places
  for each row execute function public.enforce_user_quota();
drop trigger if exists guides_quota on public.guides;
create trigger guides_quota before insert on public.guides
  for each row execute function public.enforce_user_quota();

-- ── places ────────────────────────────────────────────────────────────────
drop policy if exists "places insert" on public.places;
drop policy if exists "places update" on public.places;
drop policy if exists "places delete" on public.places;
create policy "places insert" on public.places for insert to authenticated
  with check (public.is_owner() or owner_id = auth.uid());
create policy "places update" on public.places for update to authenticated
  using (public.can_manage(owner_id)) with check (public.can_manage(owner_id));
create policy "places delete" on public.places for delete to authenticated
  using (public.can_manage(owner_id));

-- ── place_photos: follow the place ────────────────────────────────────────
drop policy if exists "place photos insert" on public.place_photos;
drop policy if exists "place photos update" on public.place_photos;
drop policy if exists "place photos delete" on public.place_photos;
create policy "place photos insert" on public.place_photos for insert to authenticated
  with check (exists (select 1 from public.places p where p.id = place_id and public.can_manage(p.owner_id)));
create policy "place photos update" on public.place_photos for update to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and public.can_manage(p.owner_id)))
  with check (exists (select 1 from public.places p where p.id = place_id and public.can_manage(p.owner_id)));
create policy "place photos delete" on public.place_photos for delete to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and public.can_manage(p.owner_id)));

-- ── guides ────────────────────────────────────────────────────────────────
drop policy if exists "guides insert" on public.guides;
drop policy if exists "guides update" on public.guides;
drop policy if exists "guides delete" on public.guides;
create policy "guides insert" on public.guides for insert to authenticated
  with check (public.is_owner() or owner_id = auth.uid());
create policy "guides update" on public.guides for update to authenticated
  using (public.can_manage(owner_id)) with check (public.can_manage(owner_id));
create policy "guides delete" on public.guides for delete to authenticated
  using (public.can_manage(owner_id));

-- ── guide_places: follow the guide ────────────────────────────────────────
drop policy if exists "guide places insert" on public.guide_places;
drop policy if exists "guide places update" on public.guide_places;
drop policy if exists "guide places delete" on public.guide_places;
create policy "guide places insert" on public.guide_places for insert to authenticated
  with check (exists (select 1 from public.guides g where g.id = guide_id and public.can_manage(g.owner_id)));
create policy "guide places update" on public.guide_places for update to authenticated
  using (exists (select 1 from public.guides g where g.id = guide_id and public.can_manage(g.owner_id)))
  with check (exists (select 1 from public.guides g where g.id = guide_id and public.can_manage(g.owner_id)));
create policy "guide places delete" on public.guide_places for delete to authenticated
  using (exists (select 1 from public.guides g where g.id = guide_id and public.can_manage(g.owner_id)));

-- ── Photo storage: a user writes inside their own folder ──────────────────
-- Uploaded files are named <user id>/<place id>-<time>.jpg. The admin can still
-- write anywhere (older files sit at the root of the bucket).
drop policy if exists "place images insert" on storage.objects;
drop policy if exists "place images delete" on storage.objects;
create policy "place images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images' and (public.is_owner() or (storage.foldername(name))[1] = auth.uid()::text));
create policy "place images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'place-images' and (public.is_owner() or (storage.foldername(name))[1] = auth.uid()::text));

-- ══ migration: 20261020190000_guide_authors.sql ════════════════════════════

-- A guide can show its author's pseudo ("by Camille").
--
-- It is free text chosen by the guide's creator, not their email or account, so
-- nothing private is published. Optional: a guide without one reads "Anonymous".
-- Editing it follows the usual guide rules (its creator, or the admin).
--
-- Written to be re-runnable.
alter table public.guides
  add column if not exists author_name text
  check (author_name is null or char_length(author_name) between 1 and 40);

-- ══ migration: 20261020200000_site_pages.sql ═══════════════════════════════

-- Editable text pages ("About us"), written by the admin from the website.
--
-- One row per page: slug ('about'), a title and a body of plain text (blank
-- lines separate paragraphs). Everyone can read; only the admin (site_owners)
-- can create, change or delete a page. The website shows a default text while
-- the row does not exist yet.
--
-- Written to be re-runnable.
create table if not exists public.site_pages (
  slug        text primary key check (slug ~ '^[a-z0-9-]{1,40}$'),
  title       text not null default '' check (char_length(title) <= 120),
  body        text not null default '' check (char_length(body) <= 20000),
  updated_at  timestamptz not null default now()
);

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at before update on public.site_pages
  for each row execute function public.set_updated_at();

alter table public.site_pages enable row level security;

drop policy if exists "site pages read"   on public.site_pages;
drop policy if exists "site pages insert" on public.site_pages;
drop policy if exists "site pages update" on public.site_pages;
drop policy if exists "site pages delete" on public.site_pages;
create policy "site pages read"   on public.site_pages for select to anon, authenticated using (true);
create policy "site pages insert" on public.site_pages for insert to authenticated with check (public.is_owner());
create policy "site pages update" on public.site_pages for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "site pages delete" on public.site_pages for delete to authenticated using (public.is_owner());

-- ══ starter data (seed.sql) ══════════════════════════════════════

-- Starter data: a few categories, places and guides so the site is not empty.
-- Applied automatically by `supabase db reset` (local database). On the hosted
-- project, run it once with `npx supabase db push --include-seed`, or paste it
-- into the SQL Editor. Safe to run more than once: it never creates duplicates.

insert into public.categories (name) values
  ('Restaurants'), ('Bars'), ('Museums'), ('Shops'), ('Parks')
on conflict (name) do nothing;

insert into public.places (name, cat, note, lat, lng)
select * from (values
  ('Musée Rodin',     'Museums', 'Sculpture garden, quiet.',   48.8553, 2.3158),
  ('Buttes-Chaumont', 'Parks',   'Sunset from the belvedere.', 48.8809, 2.3828),
  ('Le Syndicat',     'Bars',    'French spirits only.',       48.8725, 2.3532)
) as seed(name, cat, note, lat, lng)
where not exists (select 1 from public.places);

-- Placeholder guides; rename or delete them from the site.
insert into public.guides (title)
select t from unnest(array[
  'Best Bakeries', 'Hidden Gardens', 'Jazz & Late Nights',
  'Rainy-Day Museums', 'Vintage Shopping', 'Cheap Eats'
]) as t
where not exists (select 1 from public.guides);

-- Two example links, so a guide page is not empty.
insert into public.guide_places (guide_id, place_id, position)
select g.id, p.id, 1
from (values ('Hidden Gardens', 'Buttes-Chaumont'), ('Rainy-Day Museums', 'Musée Rodin')) as l(guide_title, place_name)
join public.guides g on g.title = l.guide_title
join public.places p on p.name = l.place_name
on conflict do nothing;

-- ══ the owner: EDIT THE EMAIL ════════════════════════════════════

insert into public.site_owners (email) values ('YOUR-EMAIL-HERE@example.com')
on conflict do nothing;
