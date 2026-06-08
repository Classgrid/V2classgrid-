-- Add user_avatar column to classroom_messages table
ALTER TABLE classroom_messages
ADD COLUMN IF NOT EXISTS user_avatar TEXT;
