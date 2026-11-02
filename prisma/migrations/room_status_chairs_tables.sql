-- Migration: room_status_chairs_tables
-- Adds status, numChairs, and numTables fields to the Room table

ALTER TABLE "Room"
  ADD COLUMN IF NOT EXISTS "status"    TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "numChairs" INTEGER,
  ADD COLUMN IF NOT EXISTS "numTables" INTEGER;

CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room"("status");

