-- 1. Create a trigger function to handle new user signup
-- This assigns 'admin' role to all new signups (they are first users of their org or public signups)
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

  -- Assign 'admin' role by default (EXPERT role for new signups)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Update ALL existing users to have 'admin' role to unblock current accounts
UPDATE public.user_roles SET role = 'admin'::app_role WHERE role = 'collaborator';

-- 4. Insert admin role for any users that don't have a role yet
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
  );

-- 5. Add unique constraint on profiles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 6. Fix branches RLS - Allow INSERT for authenticated users with admin/manager role
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
DROP POLICY IF EXISTS "Users can view branches in their organization" ON public.branches;
DROP POLICY IF EXISTS "Experts can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Experts can update branches" ON public.branches;
DROP POLICY IF EXISTS "Experts can delete branches" ON public.branches;

-- SELECT policy for branches
CREATE POLICY "Users can view branches in their organization"
ON public.branches
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- INSERT policy for branches (admin/manager only)
CREATE POLICY "Experts can insert branches"
ON public.branches
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- UPDATE policy for branches (admin/manager only)
CREATE POLICY "Experts can update branches"
ON public.branches
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- DELETE policy for branches (admin/manager only)
CREATE POLICY "Experts can delete branches"
ON public.branches
FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);