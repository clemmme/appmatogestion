-- 1. Add join_code column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- 2. Generate random codes for existing organizations
UPDATE public.organizations
SET join_code = 'CAB-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
WHERE join_code IS NULL;

-- 3. Make join_code NOT NULL after populating
ALTER TABLE public.organizations
ALTER COLUMN join_code SET NOT NULL;

-- 4. Create function to generate unique join code
CREATE OR REPLACE FUNCTION public.generate_unique_join_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code like CAB-X892
    new_code := 'CAB-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM organizations WHERE join_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- 5. Create function to lookup organization by join code (public access)
CREATE OR REPLACE FUNCTION public.lookup_organization_by_code(code TEXT)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name
  FROM organizations o
  WHERE o.join_code = UPPER(TRIM(code))
  AND o.subscription_status IN ('active', 'trial');
END;
$$;

-- 6. Create function to get branches for an organization (for join flow)
CREATE OR REPLACE FUNCTION public.get_organization_branches(org_id UUID)
RETURNS TABLE (
  branch_id UUID,
  branch_name TEXT,
  branch_city TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.name, b.city
  FROM branches b
  WHERE b.organization_id = org_id
  ORDER BY b.name;
END;
$$;

-- 7. Create function to register a new user with join code
CREATE OR REPLACE FUNCTION public.register_with_join_code(
  p_join_code TEXT,
  p_branch_id UUID,
  p_full_name TEXT,
  p_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_profile_id UUID;
BEGIN
  -- Validate join code
  SELECT id INTO v_org_id
  FROM organizations
  WHERE join_code = UPPER(TRIM(p_join_code))
  AND subscription_status IN ('active', 'trial');
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Code cabinet invalide ou organisation inactive';
  END IF;
  
  -- Validate branch belongs to organization
  IF p_branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM branches 
      WHERE id = p_branch_id AND organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'Établissement invalide pour cette organisation';
    END IF;
  END IF;
  
  -- Create pre-registration profile (user_id will be linked on auth.signUp)
  INSERT INTO profiles (full_name, email, organization_id, branch_id)
  VALUES (p_full_name, LOWER(TRIM(p_email)), v_org_id, p_branch_id)
  RETURNING id INTO v_profile_id;
  
  RETURN v_profile_id;
END;
$$;

-- 8. Grant execute permissions for anonymous users
GRANT EXECUTE ON FUNCTION public.lookup_organization_by_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_branches(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_with_join_code(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- 9. Update handle_new_user to set join_code on new organizations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_org_id UUID;
  v_existing_profile_id UUID;
  v_existing_org_id UUID;
  v_join_code TEXT;
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
  WHERE email = LOWER(TRIM(NEW.email))
    AND user_id IS NULL
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    -- Invitation found: Link existing profile to the new user
    UPDATE public.profiles
    SET user_id = NEW.id,
        full_name = COALESCE(v_full_name, full_name),
        updated_at = now()
    WHERE id = v_existing_profile_id;

    -- Assign 'collaborator' role for invited users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'collaborator'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    -- No invitation found: Create new organization for the user
    v_join_code := generate_unique_join_code();
    
    INSERT INTO public.organizations (name, subscription_status, join_code)
    VALUES (v_full_name || '''s Organization', 'trial', v_join_code)
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