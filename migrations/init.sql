-- init.sql : create messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  body TEXT,
  media_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- index for queries by phone number and time
CREATE INDEX IF NOT EXISTS idx_messages_phone_created ON messages (phone_number, created_at DESC);
