-- Who is the site owner? Run this ONCE on your hosted project (SQL Editor),
-- after creating your account in Authentication > Users.
--
-- 1. Replace the address below with the email of that account (keep the quotes).
-- 2. Paste this file in the SQL Editor and run it.
--
-- Until an address is listed here, nobody can edit anything: that is the safe
-- default. Several owners are fine: add one row each.

insert into public.site_owners (email) values ('you@example.com')
on conflict do nothing;
