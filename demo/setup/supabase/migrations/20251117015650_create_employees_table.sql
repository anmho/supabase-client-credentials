-- Create employees table
-- This table stores employee information for the Employee Service example

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  created_at timestamptz default now()
);

-- Add index on email for faster lookups
create index if not exists employees_email_idx on public.employees(email);

-- Add index on created_at for sorting
create index if not exists employees_created_at_idx on public.employees(created_at desc);

