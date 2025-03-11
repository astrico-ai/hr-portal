/*
  # Create clients table

  1. New Tables
    - `clients`
      - `id` (serial, primary key)
      - `legal_name` (text, required)
      - `gst_number` (text)
      - `address` (text)
      - `contact_person` (text)
      - `email` (text)
      - `phone` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
*/

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  legal_name TEXT NOT NULL,
  gst_number TEXT,
  address TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on legal_name for faster searches
CREATE INDEX IF NOT EXISTS idx_clients_legal_name ON clients(legal_name);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();