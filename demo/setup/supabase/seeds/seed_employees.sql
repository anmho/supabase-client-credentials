-- Seed data for employees table
-- This file is automatically loaded during `supabase db reset`

INSERT INTO employees (name, email) VALUES
  ('Alice Johnson', 'alice.johnson@example.com'),
  ('Bob Smith', 'bob.smith@example.com'),
  ('Carol Williams', 'carol.williams@example.com'),
  ('David Brown', 'david.brown@example.com'),
  ('Eva Davis', 'eva.davis@example.com'),
  ('Frank Miller', 'frank.miller@example.com'),
  ('Grace Wilson', 'grace.wilson@example.com'),
  ('Henry Moore', 'henry.moore@example.com'),
  ('Iris Taylor', 'iris.taylor@example.com'),
  ('Jack Anderson', 'jack.anderson@example.com')
ON CONFLICT DO NOTHING;

