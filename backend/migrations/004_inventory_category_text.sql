-- Migration 004: Replace category_id FK with plain category VARCHAR on inventory_items
-- This migration is OPTIONAL — the app works without it.
-- The backend maps the category string → categories table internally.
-- Run this only if you want to store category as plain text without the FK table.

-- Step 1: Add category column (if not already present)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) NULL AFTER organization_id;

-- Step 2: Backfill category column from existing category_id JOIN
UPDATE inventory_items i
  JOIN categories c ON c.id = i.category_id
SET i.category = c.name
WHERE i.category IS NULL AND i.category_id IS NOT NULL;

-- Step 3 (manual) — to fully drop category_id FK, run:
-- First find the constraint name: SHOW CREATE TABLE inventory_items;
-- Then: ALTER TABLE inventory_items DROP FOREIGN KEY <constraint_name>;
-- Then: ALTER TABLE inventory_items DROP COLUMN category_id;
-- NOTE: The app does NOT require steps 3 — category_id can remain as an unused nullable column.
