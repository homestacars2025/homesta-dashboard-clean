-- Create block_type enum
DO $$ BEGIN
    CREATE TYPE block_type AS ENUM ('SERVICE', 'SELLING', 'OUT_OF_SERVICE', 'HOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  car_id BIGINT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  block_type block_type NOT NULL,
  notes TEXT,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blocks_car_id ON public.blocks(car_id);
CREATE INDEX IF NOT EXISTS idx_blocks_dates ON public.blocks(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all operations for authenticated users)
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.blocks;
CREATE POLICY "Allow all operations for authenticated users" 
  ON public.blocks 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.blocks TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE blocks_id_seq TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.blocks IS 'Stores calendar blocks for cars (service, selling, out of service periods)';
