-- Immediate repair: ensure every organization has at least one admin (promote earliest user if missing)
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Loop through organizations without an admin
  FOR v_org_id IN
    SELECT o.id
    FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE p.organization_id = o.id
        AND ur.role = 'admin'::app_role
    )
  LOOP
    -- Get the earliest user in that organization
    SELECT p.user_id
    INTO v_user_id
    FROM public.profiles p
    WHERE p.organization_id = v_org_id
      AND p.user_id IS NOT NULL
    ORDER BY p.created_at ASC
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
      -- Try to update existing role first
      UPDATE public.user_roles
      SET role = 'admin'::app_role
      WHERE user_id = v_user_id;
      
      -- If no row was updated, insert a new role
      IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'admin'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;