-- URGENCE 1: Fix RLS pour éviter le blocage utilisateur
-- Règle: Un utilisateur doit TOUJOURS pouvoir lire sa propre ligne dans profiles

-- D'abord, supprimer les anciennes politiques restrictives sur profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Experts can view all profiles in organization" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles in their organization" ON public.profiles;

-- Politique PRIORITAIRE: Chaque utilisateur peut TOUJOURS voir son propre profil (fail-safe)
CREATE POLICY "Users can always view own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Politique: Les experts (admin/manager) peuvent voir tous les profils de leur organisation
CREATE POLICY "Experts can view organization profiles"
ON public.profiles
FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- Politique: Chaque utilisateur peut mettre à jour son propre profil
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid());

-- Politique: Les admins peuvent gérer (INSERT/UPDATE/DELETE) les profils de leur organisation
CREATE POLICY "Admins can manage organization profiles"
ON public.profiles
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Fix sur user_roles: Un utilisateur doit TOUJOURS pouvoir voir son propre rôle
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON public.user_roles;

-- Politique PRIORITAIRE: Chaque utilisateur peut TOUJOURS voir son rôle
CREATE POLICY "Users can always view own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Les admins peuvent voir et gérer les rôles de leur organisation
CREATE POLICY "Admins can manage organization roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.organization_id = get_user_organization_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Fix sur organizations: Un utilisateur doit pouvoir voir son organisation
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;

-- Politique: Un utilisateur peut voir son organisation
CREATE POLICY "Users can view own organization"
ON public.organizations
FOR SELECT
USING (id = get_user_organization_id(auth.uid()));

-- Les admins peuvent mettre à jour leur organisation
CREATE POLICY "Admins can update own organization"
ON public.organizations
FOR UPDATE
USING (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Créer table pour les tokens d'invitation
CREATE TABLE IF NOT EXISTS public.invitation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Activer RLS sur invitation_tokens
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent créer/voir des tokens pour leur organisation
CREATE POLICY "Admins can manage invitation tokens"
ON public.invitation_tokens
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = invitation_tokens.profile_id
    AND p.organization_id = get_user_organization_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Permettre la lecture publique des tokens valides (pour validation lors de l'inscription)
CREATE POLICY "Anyone can read valid tokens"
ON public.invitation_tokens
FOR SELECT
USING (
  expires_at > now() 
  AND used_at IS NULL
);