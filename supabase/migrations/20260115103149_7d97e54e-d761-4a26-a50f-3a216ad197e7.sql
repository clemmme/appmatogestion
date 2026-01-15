-- =============================================
-- TVA HISTORY : Suivi en 6 étapes par période
-- =============================================

-- Table pour stocker l'historique TVA par dossier et par mois
CREATE TABLE public.tva_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL, -- Format YYYY-MM
  montant NUMERIC DEFAULT 0, -- Montant TVA à payer
  credit NUMERIC DEFAULT 0,  -- Crédit de TVA
  step_compta_recue BOOLEAN DEFAULT false, -- Étape 1: Compta reçue
  step_saisie_faite BOOLEAN DEFAULT false, -- Étape 2: Saisie faite  
  step_dossier_revise BOOLEAN DEFAULT false, -- Étape 3: Dossier révisé
  step_calcul_envoye BOOLEAN DEFAULT false, -- Étape 4: Calcul envoyé client
  step_teletransmis BOOLEAN DEFAULT false, -- Étape 5: Télétransmis
  step_valide BOOLEAN DEFAULT false, -- Étape 6: Validé final
  note TEXT, -- Note libre
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dossier_id, period)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_tva_history_dossier ON public.tva_history(dossier_id);
CREATE INDEX idx_tva_history_period ON public.tva_history(period);
CREATE INDEX idx_tva_history_dossier_period ON public.tva_history(dossier_id, period);

-- Trigger pour updated_at
CREATE TRIGGER update_tva_history_updated_at
  BEFORE UPDATE ON public.tva_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.tva_history ENABLE ROW LEVEL SECURITY;

-- Policy: Voir les tva_history des dossiers accessibles
CREATE POLICY "Users can view tva_history based on role"
ON public.tva_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = tva_history.dossier_id
    AND b.organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR d.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

-- Policy: Créer des tva_history pour dossiers accessibles
CREATE POLICY "Users can create tva_history for accessible dossiers"
ON public.tva_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = tva_history.dossier_id
    AND b.organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR d.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

-- Policy: Modifier les tva_history pour dossiers accessibles
CREATE POLICY "Users can update tva_history for accessible dossiers"
ON public.tva_history FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = tva_history.dossier_id
    AND b.organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR d.manager_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

-- Policy: Supprimer (admin/manager uniquement)
CREATE POLICY "Experts can delete tva_history"
ON public.tva_history FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM dossiers d
    JOIN branches b ON d.branch_id = b.id
    WHERE d.id = tva_history.dossier_id
    AND b.organization_id = get_user_organization_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);