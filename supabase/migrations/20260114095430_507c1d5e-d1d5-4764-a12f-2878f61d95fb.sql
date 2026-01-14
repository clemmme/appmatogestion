-- ==============================================
-- FIX 1: Permettre aux Collaborateurs de créer des dossiers
-- ==============================================

-- Supprimer l'ancienne policy INSERT pour les dossiers
DROP POLICY IF EXISTS "Experts can create dossiers" ON public.dossiers;

-- Nouvelle policy : Experts ET Collaborateurs peuvent créer des dossiers
-- Pour les collaborateurs : ils doivent être assignés comme manager du dossier et le dossier doit être dans leur branche
CREATE POLICY "Users can create dossiers based on role"
ON public.dossiers
FOR INSERT
WITH CHECK (
  -- Le dossier doit appartenir à une branche de l'organisation de l'utilisateur
  EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = dossiers.branch_id
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (
    -- Admin/Manager peuvent créer n'importe quel dossier
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    -- Collaborateur peut créer uniquement si :
    -- 1. manager_id = son profile_id
    -- 2. branch_id = sa branche
    OR (
      has_role(auth.uid(), 'collaborator'::app_role)
      AND dossiers.manager_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
      )
      AND dossiers.branch_id = (
        SELECT branch_id FROM profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  )
);

-- ==============================================
-- FIX 2: Restreindre la modification des rôles aux ADMINS uniquement
-- La policy "Admins can manage organization roles" existe déjà et restreint correctement
-- Mais on s'assure que les managers ne peuvent pas modifier les profils des autres
-- ==============================================

-- Supprimer l'ancienne policy qui permet aux managers de voir les profils
DROP POLICY IF EXISTS "Experts can view organization profiles" ON public.profiles;

-- Nouvelle policy : Les managers ne voient que les profils de leur branche
CREATE POLICY "Managers can view profiles in their branch"
ON public.profiles
FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'manager'::app_role)
  AND (
    -- Manager voit son propre profil
    user_id = auth.uid()
    -- Ou les profils de sa branche
    OR branch_id = (
      SELECT p.branch_id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1
    )
  )
);

-- Nouvelle policy : Les admins voient tous les profils de l'organisation
CREATE POLICY "Admins can view all organization profiles"
ON public.profiles
FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);