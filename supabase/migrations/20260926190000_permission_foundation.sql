CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

INSERT INTO public.permissions (code, description) VALUES
('dashboard.view','View dashboard'),
('employee.view','View employee'),
('employee.create','Create employee'),
('employee.edit','Edit employee'),
('outlet.view','View outlet'),
('outlet.create','Create outlet'),
('transaction.create','Create transaction'),
('transaction.refund','Refund transaction')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
