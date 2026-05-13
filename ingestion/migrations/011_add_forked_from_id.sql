ALTER TABLE stories ADD COLUMN IF NOT EXISTS forked_from_id TEXT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_stories_fork_lookup
  ON stories (workspace_id, forked_from_id)
  WHERE forked_from_id IS NOT NULL;
