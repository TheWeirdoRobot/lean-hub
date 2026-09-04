-- LEAN Hub Database Schema
-- Run this in your Supabase SQL Editor before starting the app

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  avatar_url text,
  role text not null default 'Member',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    'Member'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  phase text not null default 'Research',
  start_date date,
  end_date date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Tasks are viewable by authenticated users"
  on tasks for select
  to authenticated
  using (true);

create policy "Authenticated users can insert tasks"
  on tasks for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Authenticated users can update tasks"
  on tasks for update
  to authenticated
  using (true);

create policy "Creators can delete tasks"
  on tasks for delete
  to authenticated
  using (auth.uid() = created_by);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_tasks_updated_at on tasks;
create trigger update_tasks_updated_at
  before update on tasks
  for each row execute procedure public.update_updated_at();


-- ─────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;

create policy "Comments are viewable by authenticated users"
  on comments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert comments"
  on comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Authors can update their comments"
  on comments for update
  to authenticated
  using (auth.uid() = author_id);

create policy "Authors can delete their comments"
  on comments for delete
  to authenticated
  using (auth.uid() = author_id);


-- ─────────────────────────────────────────
-- FILES
-- ─────────────────────────────────────────
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table files enable row level security;

create policy "Files are viewable by authenticated users"
  on files for select
  to authenticated
  using (true);

create policy "Authenticated users can insert files"
  on files for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

create policy "Uploaders can delete their files"
  on files for delete
  to authenticated
  using (auth.uid() = uploaded_by);


-- ─────────────────────────────────────────
-- STORAGE BUCKET
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload task files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'task-files');

create policy "Authenticated users can read task files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'task-files');

create policy "Uploaders can delete task files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'task-files' and auth.uid()::text = (storage.foldername(name))[1]);


-- ─────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table tasks;


-- ─────────────────────────────────────────
-- FEATURE: SUB-TEAM FIELD ON TASKS
-- Run: ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_team text DEFAULT 'Full Team' CHECK (sub_team IN ('Full Team', 'Mechanical', 'Electrical'));
-- ─────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_team text DEFAULT 'Full Team' CHECK (sub_team IN ('Full Team', 'Mechanical', 'Electrical'));

-- Drop the inline status check constraint so custom statuses from the Admin panel can be used.
-- The auto-generated constraint name is tasks_status_check in most Supabase projects.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;


-- ─────────────────────────────────────────
-- CUSTOM PHASES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_phases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#7C3AED',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users full access phases"
  ON custom_phases FOR ALL
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- CUSTOM STATUSES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_statuses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#22C55E',
  column_order int DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users full access statuses"
  ON custom_statuses FOR ALL
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- FEATURE: MULTIPLE ASSIGNEES + CSE SUB-TEAM
-- Also available standalone in migration-multi-assignee-and-cse.sql
-- ─────────────────────────────────────────
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_sub_team_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_sub_team_check
  CHECK (sub_team IN ('Full Team', 'Mechanical', 'Electrical', 'CSE'));

-- assigned_to is retained and kept in sync as the first assignee so this is reversible.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE tasks
   SET assignee_ids = ARRAY[assigned_to]
 WHERE assigned_to IS NOT NULL
   AND (assignee_ids IS NULL OR assignee_ids = '{}');

CREATE INDEX IF NOT EXISTS tasks_assignee_ids_idx ON tasks USING gin (assignee_ids);
