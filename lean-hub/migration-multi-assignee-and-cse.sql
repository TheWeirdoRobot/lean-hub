-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: multiple assignees per task + CSE sub-team
-- Run this once in Supabase Dashboard → SQL Editor before deploying the app
-- changes. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow 'CSE' as a sub-team. The original constraint was created inline by
--    ALTER TABLE ... ADD COLUMN, so Postgres auto-named it tasks_sub_team_check.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_sub_team_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_sub_team_check
  CHECK (sub_team IN ('Full Team', 'Mechanical', 'Electrical', 'CSE'));

-- 2. Multiple assignees. `assigned_to` is kept and still written as the first
--    assignee, so this migration is reversible and no existing data is lost.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';

-- 3. Backfill from the existing single assignee.
UPDATE tasks
   SET assignee_ids = ARRAY[assigned_to]
 WHERE assigned_to IS NOT NULL
   AND (assignee_ids IS NULL OR assignee_ids = '{}');

-- 4. Index for "assigned to me" lookups.
CREATE INDEX IF NOT EXISTS tasks_assignee_ids_idx ON tasks USING gin (assignee_ids);
