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
