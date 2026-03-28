-- Pricing System V3: Exchange Rates + Duration Discounts
-- Run this script to create the pricing management tables

-- 1. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_code VARCHAR(3) NOT NULL UNIQUE,
  currency_name VARCHAR(50) NOT NULL,
  rate_to_try DECIMAL(10, 4) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default exchange rates
INSERT INTO exchange_rates (currency_code, currency_name, rate_to_try) VALUES
  ('USD', 'US Dollar', 32.50),
  ('EUR', 'Euro', 35.20),
  ('LYD', 'Libyan Dinar', 6.70)
ON CONFLICT (currency_code) DO NOTHING;

-- 2. Pricing Discounts Table (duration-based)
CREATE TABLE IF NOT EXISTS pricing_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_key VARCHAR(1) NOT NULL UNIQUE,
  label VARCHAR(50) NOT NULL,
  min_days INTEGER NOT NULL,
  max_days INTEGER NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default discount buckets (A-F)
INSERT INTO pricing_discounts (bucket_key, label, min_days, max_days, discount_percent) VALUES
  ('A', '3-7 days', 3, 7, 0),
  ('B', '7-15 days', 7, 15, 5),
  ('C', '15-20 days', 15, 20, 10),
  ('D', '20-30 days', 20, 30, 15),
  ('E', '30-90 days', 30, 90, 20),
  ('F', '90-180 days', 90, 180, 25)
ON CONFLICT (bucket_key) DO NOTHING;

-- 3. Add daily_price_usd column to cars table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'daily_price_usd'
  ) THEN
    ALTER TABLE cars ADD COLUMN daily_price_usd DECIMAL(10, 2);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency ON exchange_rates(currency_code);
CREATE INDEX IF NOT EXISTS idx_pricing_discounts_days ON pricing_discounts(min_days, max_days);

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_discounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_rates
DROP POLICY IF EXISTS "Allow read access to exchange_rates" ON exchange_rates;
CREATE POLICY "Allow read access to exchange_rates" ON exchange_rates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update exchange_rates" ON exchange_rates;
CREATE POLICY "Allow authenticated users to update exchange_rates" ON exchange_rates
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for pricing_discounts
DROP POLICY IF EXISTS "Allow read access to pricing_discounts" ON pricing_discounts;
CREATE POLICY "Allow read access to pricing_discounts" ON pricing_discounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update pricing_discounts" ON pricing_discounts;
CREATE POLICY "Allow authenticated users to update pricing_discounts" ON pricing_discounts
  FOR UPDATE USING (auth.uid() IS NOT NULL);
