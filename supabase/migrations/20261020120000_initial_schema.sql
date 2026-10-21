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
