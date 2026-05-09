-- Migration script for ticket status, sort_order, and sales batch_id, fee
-- WARNING: Run this in Supabase SQL Editor to migrate existing data

-- 1. Add new columns to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS fee DECIMAL(10, 2) DEFAULT 0;

-- 2. Add new columns to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'for_sale';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Data Migration: Split tickets with quantity > 1 into multiple rows with quantity = 1
DO $$
DECLARE
    t_row RECORD;
    i INTEGER;
BEGIN
    FOR t_row IN SELECT * FROM tickets WHERE quantity > 1
    LOOP
        -- For each ticket with quantity > 1, we insert (quantity - 1) new rows
        FOR i IN 2..t_row.quantity
        LOOP
            INSERT INTO tickets (global_product_id, platform_id, cost_price, quantity, created_at, status, sort_order)
            VALUES (t_row.global_product_id, t_row.platform_id, t_row.cost_price, 1, t_row.created_at, 'for_sale', 0);
        END LOOP;
        
        -- Update the original row to quantity = 1
        UPDATE tickets SET quantity = 1 WHERE id = t_row.id;
    END LOOP;
END $$;
