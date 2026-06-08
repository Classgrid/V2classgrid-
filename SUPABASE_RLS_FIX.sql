-- ==========================================
-- FIX SUPABASE RLS POLICIES FOR CUSTOM AUTH
-- ==========================================
-- Since you are using a custom login system (not Supabase Auth), 
-- Supabase sees your users as "anon" (anonymous).
-- By default, RLS blocks inserts from "anon".

-- Run this script in the Supabase SQL Editor to fix the "new row violates row-level security policy" error.

-- 1. Drop existing strict policies (if any)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON materials;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON quizzes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON announcements;
DROP POLICY IF EXISTS "Allow Frontend Insert Materials" ON materials;
DROP POLICY IF EXISTS "Allow Frontend Insert Quizzes" ON quizzes;
DROP POLICY IF EXISTS "Allow Frontend Insert Announcements" ON announcements;

-- 2. Create Permissive Policies for Materials
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Frontend Insert Materials" ON materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Read Materials" ON materials FOR SELECT USING (true);

-- 3. Create Permissive Policies for Quizzes
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Frontend Insert Quizzes" ON quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Read Quizzes" ON quizzes FOR SELECT USING (true);

-- 4. Create Permissive Policies for Announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Frontend Insert Announcements" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Read Announcements" ON announcements FOR SELECT USING (true);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE materials, quizzes, announcements;

-- ==========================================
-- STORAGE POLICIES (Bucket: notes-files)
-- ==========================================
-- Ensure you have a bucket named 'notes-files' created and publicly accessible.
-- You might need to add policies via the Storage UI, but here is the SQL equivalent if supported:

-- Allow public read of files
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'notes-files' );

-- Allow uploads (Insert) for everyone (since your auth is custom)
-- CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'notes-files' );
