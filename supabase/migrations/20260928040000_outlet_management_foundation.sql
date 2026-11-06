-- Migration: Outlet Management Foundation
-- Adds missing outlet permissions and ensures RLS policies on outlets

INSERT INTO public.permissions (code, description) VALUES
('outlet.view', 'View outlet details and list'),
('outlet.create', 'Create new branch outlet'),
('outlet.edit', 'Edit branch outlet information'),
('outlet.delete', 'Delete branch outlet')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to owner role
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'owner'::public.app_role, p.id
FROM public.permissions p
WHERE p.code IN ('outlet.view', 'outlet.create', 'outlet.edit', 'outlet.delete')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Grant permissions to admin role
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, p.id
FROM public.permissions p
WHERE p.code IN ('outlet.view', 'outlet.create', 'outlet.edit')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Grant view permission to manager role
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::public.app_role, p.id
FROM public.permissions p
WHERE p.code = 'outlet.view'
ON CONFLICT (role, permission_id) DO NOTHING;
