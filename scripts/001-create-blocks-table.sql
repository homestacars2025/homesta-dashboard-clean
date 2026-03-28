-- Create enum type for block_type
DO $$ BEGIN
  CREATE TYPE public.block_type AS ENUM ('SERVICE', 'SELLING', 'OUT_OF_SERVICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  car_id BIGINT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  block_type public.block_type NOT NULL,
  CONSTRAINT blocks_date_range_check CHECK (end_date >= start_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS blocks_car_id_idx ON public.blocks(car_id);
CREATE INDEX IF NOT EXISTS blocks_start_date_idx ON public.blocks(start_date);
CREATE INDEX IF NOT EXISTS blocks_end_date_idx ON public.blocks(end_date);
CREATE INDEX IF NOT EXISTS blocks_date_range_idx ON public.blocks(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth requirements)
CREATE POLICY "Enable read access for all users" ON public.blocks
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.blocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.blocks
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.blocks
  FOR DELETE USING (true);

-- Add comment to table
COMMENT ON TABLE public.blocks IS 'Tracks car availability blocks for service, selling, and out-of-service periods';
