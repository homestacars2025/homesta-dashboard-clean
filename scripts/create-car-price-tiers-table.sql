-- Create car_price_tiers table for managing pricing by booking duration
CREATE TABLE IF NOT EXISTS car_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  min_days INTEGER NOT NULL CHECK (min_days >= 5),
  max_days INTEGER NOT NULL CHECK (max_days >= min_days),
  price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day > 0),
  is_active BOOLEAN DEFAULT true,
  UNIQUE (car_id, min_days, max_days)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_car_price_tiers_car_id ON car_price_tiers(car_id);
CREATE INDEX IF NOT EXISTS idx_car_price_tiers_active ON car_price_tiers(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE car_price_tiers ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow read access for authenticated users" ON car_price_tiers
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow insert for authenticated users" ON car_price_tiers
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow all authenticated users to update
CREATE POLICY "Allow update for authenticated users" ON car_price_tiers
  FOR UPDATE TO authenticated USING (true);

-- Allow all authenticated users to delete
CREATE POLICY "Allow delete for authenticated users" ON car_price_tiers
  FOR DELETE TO authenticated USING (true);
