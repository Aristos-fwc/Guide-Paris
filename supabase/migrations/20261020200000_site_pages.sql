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
