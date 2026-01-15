// =============================================
// TYPES TVA - Workflow 6 étapes
// =============================================

export interface TVAHistory {
  id: string;
  dossier_id: string;
  period: string; // Format YYYY-MM
  montant: number;
  credit: number;
  step_compta_recue: boolean;
  step_saisie_faite: boolean;
  step_dossier_revise: boolean;
  step_calcul_envoye: boolean;
  step_teletransmis: boolean;
  step_valide: boolean;
  note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TVAStep = 
  | 'step_compta_recue'
  | 'step_saisie_faite'
  | 'step_dossier_revise'
  | 'step_calcul_envoye'
  | 'step_teletransmis'
  | 'step_valide';

export const TVA_STEPS: { key: TVAStep; label: string; shortLabel: string }[] = [
  { key: 'step_compta_recue', label: 'Compta reçue', shortLabel: '1' },
  { key: 'step_saisie_faite', label: 'Saisie faite', shortLabel: '2' },
  { key: 'step_dossier_revise', label: 'Dossier révisé', shortLabel: '3' },
  { key: 'step_calcul_envoye', label: 'Calcul envoyé', shortLabel: '4' },
  { key: 'step_teletransmis', label: 'Télétransmis', shortLabel: '5' },
  { key: 'step_valide', label: 'Validé', shortLabel: '6' },
];

export type TVAStatus = 'na' | 'done' | 'progress' | 'todo';

export interface TVADossierRow {
  dossier: {
    id: string;
    code: string | null;
    nom: string;
    regime: 'M' | 'T' | 'A' | 'N'; // Mappé depuis tva_mode
    tva_deadline_day: number;
  };
  history: TVAHistory | null;
  isActive: boolean;
  status: TVAStatus;
}

// Pour le formulaire d'édition
export interface TVAHistoryFormData {
  montant: number;
  credit: number;
  steps: boolean[];
  note: string;
}
