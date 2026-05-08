-- Drop existing tables to recreate the schema
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS product_types CASCADE;
DROP TABLE IF EXISTS platforms CASCADE;

-- 1. Create platforms table
CREATE TABLE platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create product_types table
CREATE TABLE product_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create tickets table
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type_id UUID REFERENCES product_types(id) ON DELETE CASCADE,
  cost_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create sales table
CREATE TABLE sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  sell_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  profit DECIMAL(10, 2) NOT NULL,
  sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Create RLS policies if you plan to add authentication later
-- For now, if no auth is needed, you can leave RLS disabled or allow anonymous access.
-- Warning: allowing anonymous access is not secure for production.
-- You can run the following to allow all access if it's a private project:
-- ALTER TABLE platforms DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE product_types DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
