-- Create the material_summaries table for caching AI summaries
-- Run this on the CLASSROOM Supabase project

CREATE TABLE IF NOT EXISTS material_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id UUID NOT NULL UNIQUE,
    classroom_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by material_id
CREATE INDEX IF NOT EXISTS idx_material_summaries_material_id ON material_summaries (material_id);

-- Allow the service_role to manage this table (RLS disabled for server-side only access)
ALTER TABLE material_summaries ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy (since we use service_role key from backend)
CREATE POLICY "Service role full access" ON material_summaries
    FOR ALL
    USING (true)
    WITH CHECK (true);
