-- Migration script for global_products
-- WARNING: Run this in Supabase SQL Editor to migrate existing data

-- 1. Create global_products table
CREATE TABLE IF NOT EXISTS global_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add new columns to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS global_product_id UUID REFERENCES global_products(id) ON DELETE CASCADE;

-- 3. Migrate data
DO $$ 
BEGIN
  -- Insert unique product names
  INSERT INTO global_products (name)
  SELECT DISTINCT name FROM product_types
  ON CONFLICT (name) DO NOTHING;

  -- Update tickets with new relations
  UPDATE tickets t
  SET 
    platform_id = pt.platform_id,
    global_product_id = gp.id
  FROM product_types pt
  JOIN global_products gp ON gp.name = pt.name
  WHERE t.product_type_id = pt.id;
END $$;

-- 4. Make new columns required and cleanup old
ALTER TABLE tickets ALTER COLUMN platform_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN global_product_id SET NOT NULL;

ALTER TABLE tickets DROP COLUMN product_type_id CASCADE;
DROP TABLE product_types CASCADE;
