-- Add PostgreSQL exclusion constraint to prevent double-booking
-- This enforces database-level protection against overlapping bookings for the same car

-- First, enable the btree_gist extension (required for exclusion constraints with daterange)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint to bookings table
-- This prevents two bookings for the same car_id from having overlapping date ranges
-- when both are in CONFIRMED or ACTIVE status
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  car_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
)
WHERE (status IN ('CONFIRMED', 'ACTIVE'));

-- Note: The '[]' means inclusive range (both start and end dates are included)
-- The && operator checks for overlap
-- The WHERE clause ensures the constraint only applies to CONFIRMED/ACTIVE bookings
