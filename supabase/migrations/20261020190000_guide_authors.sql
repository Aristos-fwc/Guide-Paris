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
