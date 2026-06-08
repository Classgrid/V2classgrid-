-- ================================================================
-- 💬 SUPABASE CHAT FIX (Run in **Chat Project** SQL Editor)
-- ================================================================
-- Target Project ID: bumxgscngzjadyozdpce (from your logs)
-- ================================================================

-- 1. Ensure Messages Table Exists
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    classroom_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_avatar TEXT,
    user_role TEXT,
    content TEXT NOT NULL
);

-- 2. Add Columns if Table Was Incomplete
ALTER TABLE messages ADD COLUMN IF NOT EXISTS classroom_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_avatar TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT;

-- 3. Fix Column Constraints
ALTER TABLE messages ALTER COLUMN classroom_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN content SET NOT NULL;

-- 4. Enable Security (Start Fresh)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. Add Access Policy (Fixes "Permission Denied" / Server Crash)
DROP POLICY IF EXISTS "Allow public access" ON messages;
CREATE POLICY "Allow public access" ON messages FOR ALL USING (true) WITH CHECK (true);

-- 6. Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_classroom ON messages(classroom_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
