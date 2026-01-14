// Types for APPMATO GESTION
export type AppRole = 'admin' | 'manager' | 'collaborator';
export type TvaMode = 'mensuel' | 'trimestriel';
export type FormeJuridique = 'SAS' | 'SARL' | 'EURL' | 'SA' | 'SCI' | 'EI' | 'SASU' | 'SNC' | 'AUTRE';
export type RegimeFiscal = 'IS' | 'IR' | 'MICRO' | 'REEL_SIMPLIFIE' | 'REEL_NORMAL';
export type TacheType = 'TVA' | 'IS' | 'CVAE' | 'CFE' | 'LIASSE' | 'AUTRE';
export type TacheStatut = 'a_faire' | 'fait' | 'retard' | 'credit' | 'neant';

export interface Organization {
  id: string;
  name: string;
  subscription_status: string;
  join_code: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string | null;
  branch_id: string | null;
  organization_id: string | null;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Dossier {
  id: string;
  branch_id: string;
  manager_id: string | null;
  code: string | null;
  nom: string;
  siren: string | null;
  forme_juridique: FormeJuridique;
  regime_fiscal: RegimeFiscal;
  cloture: string | null;
  tva_mode: TvaMode;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  branch?: Branch;
  manager?: Profile;
}

export interface TacheFiscale {
  id: string;
  dossier_id: string;
  type: TacheType;
  date_echeance: string;
  statut: TacheStatut;
  montant: number | null;
  commentaire: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  dossier?: Dossier;
}

// Matrix view types
export interface MatrixCell {
  dossier_id: string;
  month: string; // Format: YYYY-MM
  type: TacheType;
  tache?: TacheFiscale;
}

export interface MatrixRow {
  dossier: Dossier;
  cells: Record<string, TacheFiscale | null>; // key: YYYY-MM
}
