-- ================================================================
-- 🚀 FORCE REALTIME FIX (Run in Supabase "SQL Editor")
-- ================================================================

-- 1. Enable REPLICA IDENTITY FULL
-- Expected to fix "no broadcast" issue on INSERT
ALTER TABLE classroom_messages REPLICA IDENTITY FULL;

-- 2. Ensure RLS Allows SELECT (Critical for Realtime)
-- Realtime respects RLS. If checking/selecting is blocked, the row is hidden.
DROP POLICY IF EXISTS "Allow read access for realtime" ON classroom_messages;

CREATE POLICY "Allow read access for realtime"
ON classroom_messages
FOR SELECT
USING (true); -- Allows everyone to read (needed for Realtime + Anon key)

-- 3. Verify Table & Columns
-- Run this to double-check your schema matches the code
SELECT
    column_name,
    data_type
FROM
    information_schema.columns
WHERE
    table_name = 'classroom_messages';

-- ================================================================
-- ✅ AFTER RUNNING THIS:
-- 1. Restart your local server / refresh the page.
-- 2. If valid, new messages should appear instantly.
-- ================================================================
