-- Migration 003: Add customer_name and customer_phone text columns to invoices
-- Run this once to support text-based customer entry (no longer requires customers FK)
-- Safe to run multiple times (uses IF NOT EXISTS / column check)

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_name  VARCHAR(255) DEFAULT NULL AFTER customer_id,
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50)  DEFAULT NULL AFTER customer_name;
