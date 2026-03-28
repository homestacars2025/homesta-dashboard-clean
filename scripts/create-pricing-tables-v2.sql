-- Create pricing policy buckets table (global discount rules)
CREATE TABLE IF NOT EXISTS pricing_policy_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key CHAR(1) NOT NULL UNIQUE, -- A, B, C, D, E, F
  label VARCHAR(50) NOT NULL, -- "Short Term", "Weekly", etc.
  min_days INT NOT NULL,
  max_days INT NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0, 5, 8, 12, 18, 25
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_days CHECK (min_days > 0 AND max_days >= min_days)
);

-- Create car base pricing table (one row per car)
CREATE TABLE IF NOT EXISTS car_base_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id INT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  base_price_per_day DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TRY',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_car_pricing UNIQUE (car_id),
  CONSTRAINT positive_price CHECK (base_price_per_day > 0)
);

-- Insert default pricing buckets
INSERT INTO pricing_policy_buckets (bucket_key, label, min_days, max_days, discount_percent) VALUES
  ('A', 'Short Term', 5, 7, 0),
  ('B', 'Weekly', 8, 15, 5),
  ('C', 'Bi-Weekly', 16, 20, 8),
  ('D', 'Monthly', 21, 30, 12),
  ('E', 'Extended', 31, 90, 18),
  ('F', 'Long Term', 91, 180, 25)
ON CONFLICT (bucket_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_car_base_pricing_car_id ON car_base_pricing(car_id);
CREATE INDEX IF NOT EXISTS idx_pricing_policy_buckets_days ON pricing_policy_buckets(min_days, max_days);
