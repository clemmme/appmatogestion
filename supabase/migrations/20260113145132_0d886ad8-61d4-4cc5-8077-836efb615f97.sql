-- Fix: Restrict profile visibility to prevent email disclosure to all organization members
-- Collaborators should only see their own profile, while admins/managers can see all profiles

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create more restrictive policies:
-- 1. Admins and managers can see all profiles in their organization
CREATE POLICY "Experts can view all profiles in organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- 2. Regular users (collaborators) can only see their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());