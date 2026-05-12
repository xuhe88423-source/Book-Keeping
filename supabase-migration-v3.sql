-- Migration script for adding is_hidden to global_products
-- WARNING: Run this in Supabase SQL Editor to migrate existing data

-- Add is_hidden column to global_products table
ALTER TABLE global_products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
