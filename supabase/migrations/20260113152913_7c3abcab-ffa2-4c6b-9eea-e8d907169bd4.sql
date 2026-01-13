-- Fix: User invitation flow now properly links to existing organization
-- When a user signs up, check if they were invited (profile exists with email but no user_id)
-- If invited, link them to the existing organization instead of creating a new one

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_org_id uuid;
  v_existing_profile_id uuid;
  v_existing_org_id uuid;
BEGIN
  -- Extract full_name from user metadata
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );

  -- Check for pending invitation (profile with matching email but no user_id)
  SELECT id, organization_id 
  INTO v_existing_profile_id, v_existing_org_id
  FROM public.profiles
  WHERE email = NEW.email
    AND user_id IS NULL
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    -- Invitation found: Link existing profile to the new user
    UPDATE public.profiles
    SET user_id = NEW.id,
        full_name = COALESCE(v_full_name, full_name),
        updated_at = now()
    WHERE id = v_existing_profile_id;

    -- Assign 'collaborator' role for invited users (admin sets proper role)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'collaborator'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    -- No invitation found: Create new organization for the user
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
  END IF;

  RETURN NEW;
END;
$$;