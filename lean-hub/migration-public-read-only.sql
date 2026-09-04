-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: public read-only access
-- Lets anyone with the site link view the board, timeline and team without
-- signing in. Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- SCOPE: tasks, profiles, phases and statuses become readable by the `anon`
-- role. `comments` and `files` are deliberately left out, so internal
-- discussion and attachments stay visible only to signed-in team members.
--
-- WRITES ARE UNAFFECTED: every insert/update/delete policy is `to authenticated`,
-- and no anon write policy is created here, so visitors cannot change anything.
--
-- NOTE: profiles exposes full_name and role only — there is no email column.
-- TO REVOKE: drop the four policies below.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Anyone can view tasks" on tasks;
create policy "Anyone can view tasks"
  on tasks for select to anon using (true);

drop policy if exists "Anyone can view profiles" on profiles;
create policy "Anyone can view profiles"
  on profiles for select to anon using (true);

drop policy if exists "Anyone can view phases" on custom_phases;
create policy "Anyone can view phases"
  on custom_phases for select to anon using (true);

drop policy if exists "Anyone can view statuses" on custom_statuses;
create policy "Anyone can view statuses"
  on custom_statuses for select to anon using (true);
