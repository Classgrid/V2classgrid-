-- ==============================================================================
-- 🚀 FULL SUPABASE INITIALIZATION SCRIPT FOR NEW PROJECT (bumxgscngzjadyozdpce)
-- ==============================================================================
-- Copy and paste this entire file into the Supabase SQL Editor and hit "Run".
-- This script creates all required tables, columns, indexes, and RLS policies.
-- ==============================================================================

-- ════════════════════════════════════════════════════════════════
-- 1. MATERIALS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT,
    subject_slug TEXT,
    file_url TEXT,
    uploaded_by TEXT,
    type TEXT,
    classroom_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_materials_classroom ON materials(classroom_id);
CREATE INDEX IF NOT EXISTS idx_materials_classroom_subject ON materials(classroom_id, subject_slug);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Frontend Insert Materials" ON materials;
DROP POLICY IF EXISTS "Allow Public Read Materials" ON materials;
CREATE POLICY "Allow Frontend Insert Materials" ON materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Read Materials" ON materials FOR SELECT USING (true);


-- ════════════════════════════════════════════════════════════════
-- 2. ANNOUNCEMENTS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    message TEXT,
    subject_slug TEXT,
    posted_by TEXT,
    tags JSONB,
    classroom_id TEXT,
    title TEXT,
    content TEXT
);
CREATE INDEX IF NOT EXISTS idx_announcements_classroom ON announcements(classroom_id);
CREATE INDEX IF NOT EXISTS idx_announcements_classroom_subject ON announcements(classroom_id, subject_slug);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Frontend Insert Announcements" ON announcements;
DROP POLICY IF EXISTS "Allow Public Read Announcements" ON announcements;
CREATE POLICY "Allow Frontend Insert Announcements" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Read Announcements" ON announcements FOR SELECT USING (true);


-- ════════════════════════════════════════════════════════════════
-- 3. QUIZZES TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    classroom_id TEXT,
    subject_slug TEXT
);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom ON quizzes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom_subject ON quizzes(classroom_id, subject_slug);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Frontend Insert Quizzes" ON quizzes;
DROP POLICY IF EXISTS "Allow Public Read Quizzes" ON quizzes;
CREATE POLICY "Allow Frontend Insert Quizzes" ON quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Read Quizzes" ON quizzes FOR SELECT USING (true);


-- ════════════════════════════════════════════════════════════════
-- 4. CLASSROOM MESSAGES TABLE (Chat System)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS classroom_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    classroom_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    user_avatar TEXT,
    message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classroom_messages_created_at ON classroom_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_classroom_messages_classroom_id ON classroom_messages(classroom_id);

ALTER TABLE classroom_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read classroom messages" ON classroom_messages;
DROP POLICY IF EXISTS "Allow service role insert" ON classroom_messages;
DROP POLICY IF EXISTS "Allow service role delete" ON classroom_messages;
DROP POLICY IF EXISTS "Allow public insert access" ON classroom_messages;
DROP POLICY IF EXISTS "Unrestricted read access for dev" ON classroom_messages;

-- Since frontend handles real-time via anon key:
CREATE POLICY "Unrestricted read access for dev" ON classroom_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON classroom_messages FOR INSERT WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- 5. STUDENT NOTES TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS student_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT,
    description TEXT,
    file_url TEXT,
    file_path TEXT,
    organization_id TEXT,
    uploaded_by TEXT,
    uploader_id TEXT,
    uploader_role TEXT,
    note_type TEXT,
    status TEXT DEFAULT 'pending'
);

ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Public Student Notes Access" ON student_notes;
CREATE POLICY "Allow Public Student Notes Access" ON student_notes FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- 6. MATERIAL SUMMARIES TABLE (AI caching)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS material_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id UUID NOT NULL UNIQUE,
    classroom_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_summaries_material_id ON material_summaries (material_id);

ALTER TABLE material_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON material_summaries;
CREATE POLICY "Service role full access" ON material_summaries FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- 7. CHAT MESSAGES (Alternative Chat Table - From your migration scripts)
-- ════════════════════════════════════════════════════════════════
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
CREATE INDEX IF NOT EXISTS idx_messages_classroom ON messages(classroom_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON messages;
CREATE POLICY "Allow public access" ON messages FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- 8. ENABLE REALTIME (Safely)
-- ════════════════════════════════════════════════════════════════
-- This is necessary for chat and live updates to work on the frontend
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE materials, quizzes, announcements, classroom_messages, messages;
EXCEPTION WHEN duplicate_object THEN 
  -- Ignore error if they are already in the publication
  NULL;
END; $$;


-- ════════════════════════════════════════════════════════════════
-- 9. AUTO-DELETE CHAT MESSAGES AFTER 48 HOURS (CRON)
-- ════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION delete_expired_chat_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM classroom_messages WHERE created_at < NOW() - INTERVAL '48 hours';
  DELETE FROM messages WHERE created_at < NOW() - INTERVAL '48 hours';
END;
$$;

SELECT cron.unschedule('cleanup-expired-chat-messages') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-chat-messages');
SELECT cron.schedule('cleanup-expired-chat-messages', '0 * * * *', $$SELECT delete_expired_chat_messages();$$);


-- ==============================================================================
-- DONE! Your new Supabase project is now fully configured for Classgrid V2.
-- ==============================================================================
