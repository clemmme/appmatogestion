-- Fix: Auto-create organization for new user signups
-- This ensures new users can immediately access the app by creating their own organization

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_org_id uuid;
BEGIN
  -- Extract full_name from user metadata
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );

  -- Create a new organization for the user
  INSERT INTO public.organizations (name, subscription_status)
  VALUES (v_full_name || '''s Organization', 'trial')
  RETURNING id INTO v_org_id;

  -- Create profile with organization assignment
  INSERT INTO public.profiles (user_id, full_name, email, organization_id)
  VALUES (NEW.id, v_full_name, NEW.email, v_org_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign 'admin' role (first user of their org should be admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;