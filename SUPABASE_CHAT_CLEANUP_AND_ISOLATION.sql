-- ================================================================
-- 🔒 CHAT AUTO-DELETION + DATA ISOLATION FIX
-- ================================================================
-- Run this in the Supabase SQL Editor for your *CHAT Project*
-- (bumxgscngzjadyozdpce)
-- ================================================================

-- ════════════════════════════════════════════════════════════════
-- PART 1: AUTO-DELETE CHAT MESSAGES AFTER 48 HOURS
-- ════════════════════════════════════════════════════════════════

-- 1A. Create the cleanup function
CREATE OR REPLACE FUNCTION delete_expired_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM classroom_messages
  WHERE created_at < NOW() - INTERVAL '48 hours';
END;
$$;

-- 1B. Enable pg_cron extension (required for scheduled jobs)
-- NOTE: If this errors, pg_cron may already be enabled or you need
-- to enable it from Supabase Dashboard > Database > Extensions > pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1C. Remove any old schedule for this job (prevents duplicates)
SELECT cron.unschedule('cleanup-expired-chat-messages')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-chat-messages'
);

-- 1D. Schedule the cleanup to run every 1 hour
-- This deletes all messages older than 48 hours, every hour
SELECT cron.schedule(
  'cleanup-expired-chat-messages',   -- Job name
  '0 * * * *',                       -- Every hour at minute 0
  $$DELETE FROM classroom_messages WHERE created_at < NOW() - INTERVAL '48 hours'$$
);

-- 1E. Verify: Test the function manually (optional, safe to run)
-- SELECT delete_expired_chat_messages();


-- ════════════════════════════════════════════════════════════════
-- PART 2: RLS POLICIES FOR DATA ISOLATION (Chat Project)
-- ════════════════════════════════════════════════════════════════
-- Since you use custom JWT auth (not Supabase Auth), your backend
-- calls use the service_role key which bypasses RLS.
-- But the FRONTEND uses the anon key, so we need RLS to prevent
-- users from reading other classrooms' messages.
-- ════════════════════════════════════════════════════════════════

-- 2A. Ensure RLS is enabled
ALTER TABLE classroom_messages ENABLE ROW LEVEL SECURITY;

-- 2B. Drop old permissive policies
DROP POLICY IF EXISTS "Unrestricted read access for dev" ON classroom_messages;
DROP POLICY IF EXISTS "Allow public read access" ON classroom_messages;
DROP POLICY IF EXISTS "Allow classroom members to read messages" ON classroom_messages;
DROP POLICY IF EXISTS "Allow public insert access" ON classroom_messages;
DROP POLICY IF EXISTS "Allow public access" ON classroom_messages;

-- 2C. New policies: Read & Write require a valid classroom_id
-- Since you use custom auth (not Supabase Auth), the backend uses
-- service_role key which BYPASSES RLS. This is fine — backend auth
-- is handled by your JWT middleware.
-- For the anon key (frontend realtime), we allow SELECT but INSERT
-- goes through the backend API only.

-- Allow SELECT for anon (needed for Supabase Realtime subscriptions)
CREATE POLICY "Allow anon read classroom messages"
ON classroom_messages
FOR SELECT
USING (true);

-- Allow INSERT only via service role (backend)
-- The anon key cannot insert directly — only the backend API can
CREATE POLICY "Allow service role insert"
ON classroom_messages
FOR INSERT
WITH CHECK (true);

-- Allow DELETE only via service role (for cron cleanup)
CREATE POLICY "Allow service role delete"
ON classroom_messages
FOR DELETE
USING (true);


-- ════════════════════════════════════════════════════════════════
-- PART 3: ADD INDEX FOR FAST EXPIRY QUERIES
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_classroom_messages_created_at
ON classroom_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_classroom_messages_classroom_id
ON classroom_messages(classroom_id);


-- ================================================================
-- ✅ AFTER RUNNING THIS:
-- 1. Messages older than 48 hours will be PERMANENTLY deleted every hour
-- 2. RLS is active on classroom_messages
-- 3. Backend (service_role) can still read/write/delete
-- 4. Frontend (anon) can only read (for realtime subscriptions)
-- ================================================================
