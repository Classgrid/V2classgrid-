-- ================================================================
-- 🚀 FIX: ALLOW MESSAGE LOADING (Refresh Issue)
-- ================================================================
-- Run this in the Supabase SQL Editor for your *Chat Project*
-- ================================================================

-- 1. Ensure Table Exists (referencing correct table name)
CREATE TABLE IF NOT EXISTS classroom_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    classroom_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    user_avatar TEXT,
    message TEXT NOT NULL
);

-- 2. Enable RLS (Security)
ALTER TABLE classroom_messages ENABLE ROW LEVEL SECURITY;

-- 3. FIX: Add SELECT Policy (This fixes the "empty list on refresh" bug)
-- Drops old policy to prevent conflicts
DROP POLICY IF EXISTS "Allow public read access" ON classroom_messages;
DROP POLICY IF EXISTS "Allow classroom members to read messages" ON classroom_messages;

-- Create the fix policy (Allows backend/frontend to read messages)
CREATE POLICY "Unrestricted read access for dev"
ON classroom_messages
FOR SELECT
USING (true);

-- 4. Ensure INSERT Policy Exists (since typing/sending works, we keep/ensure this)
DROP POLICY IF EXISTS "Allow public insert access" ON classroom_messages;
CREATE POLICY "Allow public insert access"
ON classroom_messages
FOR INSERT
WITH CHECK (true);

-- 5. Add/Fix Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_classroom_messages_classroom_id ON classroom_messages(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_messages_created_at ON classroom_messages(created_at);

-- ================================================================
-- ✅ READY TO RUN
-- Messages should now load correctly after refresh.
-- ================================================================
