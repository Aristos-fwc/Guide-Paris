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
