-- Create bookings table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  arrival VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  date VARCHAR(100) NOT NULL,
  number_of_people INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Create an index on email for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);

-- Optional: Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

