-- ==========================================
-- SUPABASE SCHEMA UPDATES FOR CLASSROOM SYSTEM
-- ==========================================
-- Run this in the Supabase SQL Editor to add classroom_id support.
-- NOTE: The backend already works without this migration via subject_slug fallback.
-- This migration enables future per-classroom content isolation.

-- 1. ADD classroom_id TO ALL CONTENT TABLES
-- (Links Supabase content rows to MongoDB classroom IDs)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS classroom_id TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS classroom_id TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS classroom_id TEXT;

-- 2. ADD MISSING COLUMNS TO ANNOUNCEMENTS (normalize with materials/quizzes)
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS content TEXT;

-- 3. CREATE INDEXES FOR FAST LOOKUPS
CREATE INDEX IF NOT EXISTS idx_materials_classroom ON materials(classroom_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom ON quizzes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_announcements_classroom ON announcements(classroom_id);

-- 4. COMPOSITE INDEXES (classroom_id + subject_slug for backward compat)
CREATE INDEX IF NOT EXISTS idx_materials_classroom_subject ON materials(classroom_id, subject_slug);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom_subject ON quizzes(classroom_id, subject_slug);
CREATE INDEX IF NOT EXISTS idx_announcements_classroom_subject ON announcements(classroom_id, subject_slug);

-- ==========================================
-- CURRENT TABLE SCHEMAS (for reference):
-- ==========================================
-- materials:      id, created_at, title, subject_slug, file_url, uploaded_by, type
-- announcements:  id, created_at, message, subject_slug, posted_by, tags
-- quizzes:        id, created_at, (+ other columns TBD when quizzes are added)
-- ==========================================

-- 5. OPTIONAL: Assign existing content to classroom IDs
-- Run after you know your classroom MongoDB IDs:
-- UPDATE materials SET classroom_id = '<CHEMISTRY_CLASSROOM_ID>' WHERE subject_slug = 'chemistry';
-- UPDATE announcements SET classroom_id = '<CHEMISTRY_CLASSROOM_ID>' WHERE subject_slug = 'chemistry';
