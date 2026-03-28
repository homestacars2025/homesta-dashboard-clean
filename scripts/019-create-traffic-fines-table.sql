-- Create traffic_fines table
CREATE TABLE IF NOT EXISTS traffic_fines (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  plate_number VARCHAR(50) NOT NULL,
  violation_number VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255),
  notification_date DATE,
  amount DECIMAL(10, 2),
  location TEXT,
  violation_date DATE,
  violation_time TIME,
  article VARCHAR(100),
  description TEXT,
  fine_image_url TEXT,
  fine_pdf_url TEXT,
  payment_receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on plate_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_traffic_fines_plate_number ON traffic_fines(plate_number);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_traffic_fines_status ON traffic_fines(status);

-- Create index on violation_number
CREATE INDEX IF NOT EXISTS idx_traffic_fines_violation_number ON traffic_fines(violation_number);

-- Enable RLS
ALTER TABLE traffic_fines ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read all fines
CREATE POLICY "Allow authenticated users to read traffic fines"
  ON traffic_fines
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for authenticated users to insert fines
CREATE POLICY "Allow authenticated users to insert traffic fines"
  ON traffic_fines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy for authenticated users to update fines
CREATE POLICY "Allow authenticated users to update traffic fines"
  ON traffic_fines
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users to delete fines
CREATE POLICY "Allow authenticated users to delete traffic fines"
  ON traffic_fines
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_traffic_fines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_traffic_fines_updated_at
  BEFORE UPDATE ON traffic_fines
  FOR EACH ROW
  EXECUTE FUNCTION update_traffic_fines_updated_at();
