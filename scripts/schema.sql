CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  legal_name VARCHAR(255) NOT NULL,
  gst_number VARCHAR(50),
  billing_address TEXT,
  pincode VARCHAR(10),
  state VARCHAR(100),
  country VARCHAR(100),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_by_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 