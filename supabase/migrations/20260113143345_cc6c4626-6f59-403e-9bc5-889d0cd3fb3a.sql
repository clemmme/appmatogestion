-- Fix: Change default role from 'admin' to 'collaborator' for new signups
-- This prevents privilege escalation where any user could gain admin access

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
BEGIN
  -- Extract full_name from user metadata
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );

  -- Create profile for the new user
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign 'collaborator' role by default (admins must promote users manually)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'collaborator'::app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;