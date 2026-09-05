-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: explicit sub-teams + members who don't have an account yet
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- 1. profiles.sub_team replaces guessing a person's sub-team from their tasks.
-- 2. A profile can now exist without an auth user ("placeholder"), so you can
--    add teammates before they sign up and assign them work.
-- 3. When a placeholder's email signs up, everything pointing at the
--    placeholder is moved onto the real account and the placeholder is removed.
--
-- WHY IT WORKS THIS WAY: tasks.created_by, comments.author_id, files.uploaded_by
-- and the storage policies all compare against auth.uid(), so a signed-in
-- member's profile id MUST equal their auth user id. Placeholders therefore get
-- their own random id and are merged away on signup, rather than the profile
-- keeping a separate "user_id" column.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columns ───────────────────────────────────────────────────────────────

-- Profiles no longer have to correspond to an auth user.
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();

alter table profiles add column if not exists sub_team text not null default 'Full Team';
alter table profiles add column if not exists is_placeholder boolean not null default false;
-- Only used to match a signup to a placeholder. Never exposed publicly (see §4).
alter table profiles add column if not exists email text;

alter table profiles drop constraint if exists profiles_sub_team_check;
alter table profiles add constraint profiles_sub_team_check
  check (sub_team in ('Full Team', 'Mechanical', 'Electrical', 'CSE'));

-- Backfill emails for existing members so they'd match if re-invited.
update profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is null;

create index if not exists profiles_email_idx on profiles (lower(email));

-- ── 2. Roster permissions ────────────────────────────────────────────────────
-- Any signed-in member can maintain the roster. This matches how tasks already
-- work in this app (any member can edit any task). Placeholders can be deleted;
-- profiles backed by a real account cannot.

drop policy if exists "Members can add placeholder members" on profiles;
create policy "Members can add placeholder members"
  on profiles for insert to authenticated
  with check (is_placeholder = true);

drop policy if exists "Members can update the roster" on profiles;
create policy "Members can update the roster"
  on profiles for update to authenticated
  using (true) with check (true);

drop policy if exists "Members can remove placeholder members" on profiles;
create policy "Members can remove placeholder members"
  on profiles for delete to authenticated
  using (is_placeholder = true);

-- ── 3. Link a signup to the placeholder that was waiting for it ──────────────

create or replace function public.handle_new_user()
returns trigger as $$
declare
  ph public.profiles%rowtype;
begin
  select * into ph
    from public.profiles
   where is_placeholder = true
     and email is not null
     and lower(email) = lower(new.email)
   order by created_at
   limit 1;

  insert into public.profiles (id, full_name, avatar_url, role, email, sub_team, is_placeholder)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), ph.full_name, ''),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(ph.role, 'Member'),
    new.email,
    coalesce(ph.sub_team, 'Full Team'),
    false
  );

  -- Move the placeholder's history onto the real account, then retire it
  if ph.id is not null then
    update public.tasks set assigned_to = new.id where assigned_to = ph.id;
    update public.tasks set assignee_ids = array_replace(assignee_ids, ph.id, new.id)
      where ph.id = any(assignee_ids);
    update public.tasks set created_by = new.id where created_by = ph.id;
    update public.comments set author_id = new.id where author_id = ph.id;
    update public.files set uploaded_by = new.id where uploaded_by = ph.id;
    delete from public.profiles where id = ph.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- ── 4. Keep emails out of the public read-only view ──────────────────────────
-- Signed-out visitors can read profiles (migration-public-read-only.sql). RLS is
-- row-level, so column privileges are what hide the email column from them.
-- Anything added to profiles later is hidden from anon until granted here.

revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url, role, sub_team, is_placeholder, created_at)
  on public.profiles to anon;
