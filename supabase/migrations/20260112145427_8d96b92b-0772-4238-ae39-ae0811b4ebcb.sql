-- Fix security: Block unauthenticated access to all tables
-- The current policies only work for authenticated users within same org
-- We need to add explicit authentication requirement

-- Drop existing policies and recreate with proper auth checks

-- PROFILES table policies
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage profiles in their organization" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

-- DOSSIERS table policies
DROP POLICY IF EXISTS "Users can view dossiers in their organization" ON public.dossiers;
DROP POLICY IF EXISTS "Users can create dossiers in their branch" ON public.dossiers;
DROP POLICY IF EXISTS "Users can update dossiers in their organization" ON public.dossiers;
DROP POLICY IF EXISTS "Admins can delete dossiers" ON public.dossiers;

-- Expert (admin/manager) can see all dossiers in their org
-- Collaborator can only see dossiers assigned to them
CREATE POLICY "Users can view dossiers based on role" 
ON public.dossiers 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM branches b 
    WHERE b.id = dossiers.branch_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
    OR dossiers.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "Experts can create dossiers" 
ON public.dossiers 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM branches b 
    WHERE b.id = dossiers.branch_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Users can update dossiers based on role" 
ON public.dossiers 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM branches b 
    WHERE b.id = dossiers.branch_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
    OR dossiers.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "Experts can delete dossiers" 
ON public.dossiers 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM branches b 
    WHERE b.id = dossiers.branch_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- BRANCHES table policies  
DROP POLICY IF EXISTS "Users can view branches in their organization" ON public.branches;
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;

CREATE POLICY "Users can view branches in their organization" 
ON public.branches 
FOR SELECT 
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage branches" 
ON public.branches 
FOR ALL 
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- ORGANIZATIONS table policies
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;

CREATE POLICY "Users can view their organization" 
ON public.organizations 
FOR SELECT 
TO authenticated
USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can update their organization" 
ON public.organizations 
FOR UPDATE 
TO authenticated
USING (
  id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- TACHES_FISCALES table policies
DROP POLICY IF EXISTS "Users can view taches in their organization" ON public.taches_fiscales;
DROP POLICY IF EXISTS "Users can create taches" ON public.taches_fiscales;
DROP POLICY IF EXISTS "Users can update taches in their organization" ON public.taches_fiscales;
DROP POLICY IF EXISTS "Managers can delete taches" ON public.taches_fiscales;

CREATE POLICY "Users can view taches based on role" 
ON public.taches_fiscales 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = taches_fiscales.dossier_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
      OR d.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "Users can create taches for accessible dossiers" 
ON public.taches_fiscales 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = taches_fiscales.dossier_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
      OR d.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "Users can update taches for accessible dossiers" 
ON public.taches_fiscales 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = taches_fiscales.dossier_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
      OR d.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "Experts can delete taches" 
ON public.taches_fiscales 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = taches_fiscales.dossier_id 
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- USER_ROLES table policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their organization" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = user_roles.user_id 
    AND p.organization_id = get_user_organization_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);