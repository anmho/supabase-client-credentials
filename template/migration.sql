-- Create machine_secrets table for M2M authentication
CREATE TABLE IF NOT EXISTS machine_secrets (
    client_id TEXT PRIMARY KEY,
    client_secret_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on is_active for efficient filtering
CREATE INDEX IF NOT EXISTS idx_machine_secrets_is_active ON machine_secrets(is_active);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on row updates
CREATE TRIGGER update_machine_secrets_updated_at
    BEFORE UPDATE ON machine_secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE machine_secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access machine_secrets
-- This ensures that only the Edge Function (using service role) can read secrets
CREATE POLICY "Service role can manage machine_secrets"
    ON machine_secrets
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

