-- =============================================
-- APPMATO GESTION - Schema Multi-Tenant
-- =============================================

-- 1. Enum pour les rôles utilisateurs
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'collaborator');

-- 2. Enum pour le mode TVA
CREATE TYPE public.tva_mode AS ENUM ('mensuel', 'trimestriel');

-- 3. Enum pour les formes juridiques
CREATE TYPE public.forme_juridique AS ENUM ('SAS', 'SARL', 'EURL', 'SA', 'SCI', 'EI', 'SASU', 'SNC', 'AUTRE');

-- 4. Enum pour les régimes fiscaux
CREATE TYPE public.regime_fiscal AS ENUM ('IS', 'IR', 'MICRO', 'REEL_SIMPLIFIE', 'REEL_NORMAL');

-- 5. Enum pour les types de tâches fiscales
CREATE TYPE public.tache_type AS ENUM ('TVA', 'IS', 'CVAE', 'CFE', 'LIASSE', 'AUTRE');

-- 6. Enum pour les statuts de tâches
CREATE TYPE public.tache_statut AS ENUM ('a_faire', 'fait', 'retard', 'credit', 'neant');

-- =============================================
-- TABLE: Organizations (Niveau 1 - Cabinets)
-- =============================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: Branches (Niveau 2 - Établissements)
-- =============================================
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: Profiles (Niveau 3 - Utilisateurs)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: User Roles (Séparé pour sécurité)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'collaborator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: Dossiers (Niveau 4 - Clients du cabinet)
-- =============================================
CREATE TABLE public.dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  code TEXT,
  nom TEXT NOT NULL,
  siren TEXT,
  forme_juridique forme_juridique DEFAULT 'AUTRE',
  regime_fiscal regime_fiscal DEFAULT 'IS',
  cloture DATE,
  tva_mode tva_mode DEFAULT 'mensuel',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: Tâches Fiscales
-- =============================================
CREATE TABLE public.taches_fiscales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  type tache_type NOT NULL DEFAULT 'TVA',
  date_echeance DATE NOT NULL,
  statut tache_statut DEFAULT 'a_faire',
  montant DECIMAL(15, 2),
  commentaire TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.taches_fiscales ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FUNCTION: Get user's organization_id
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = user_uuid LIMIT 1;
$$;

-- =============================================
-- FUNCTION: Check user role
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(user_uuid UUID, required_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role = required_role
  );
$$;

-- =============================================
-- FUNCTION: Update timestamps
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_dossiers_updated_at BEFORE UPDATE ON public.dossiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_taches_updated_at BEFORE UPDATE ON public.taches_fiscales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- RLS POLICIES: Organizations
-- =============================================
CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (id = public.get_user_organization_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES: Branches
-- =============================================
CREATE POLICY "Users can view branches in their organization"
  ON public.branches FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage branches"
  ON public.branches FOR ALL
  USING (organization_id = public.get_user_organization_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES: Profiles
-- =============================================
CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage profiles in their organization"
  ON public.profiles FOR ALL
  USING (organization_id = public.get_user_organization_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES: User Roles
-- =============================================
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their organization"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = public.user_roles.user_id
      AND p.organization_id = public.get_user_organization_id(auth.uid())
    )
    AND public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- RLS POLICIES: Dossiers
-- =============================================
CREATE POLICY "Users can view dossiers in their organization"
  ON public.dossiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = dossiers.branch_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can create dossiers in their branch"
  ON public.dossiers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can update dossiers in their organization"
  ON public.dossiers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = dossiers.branch_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Admins can delete dossiers"
  ON public.dossiers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = dossiers.branch_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
    AND public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- RLS POLICIES: Tâches Fiscales
-- =============================================
CREATE POLICY "Users can view taches in their organization"
  ON public.taches_fiscales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dossiers d
      JOIN public.branches b ON d.branch_id = b.id
      WHERE d.id = taches_fiscales.dossier_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can create taches"
  ON public.taches_fiscales FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dossiers d
      JOIN public.branches b ON d.branch_id = b.id
      WHERE d.id = dossier_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Users can update taches in their organization"
  ON public.taches_fiscales FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dossiers d
      JOIN public.branches b ON d.branch_id = b.id
      WHERE d.id = taches_fiscales.dossier_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Managers can delete taches"
  ON public.taches_fiscales FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dossiers d
      JOIN public.branches b ON d.branch_id = b.id
      WHERE d.id = taches_fiscales.dossier_id
      AND b.organization_id = public.get_user_organization_id(auth.uid())
    )
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );