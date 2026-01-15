// =============================================
// UTILS / LOGIQUE METIER TVA
// =============================================

import { TVAHistory, TVAStatus, TVA_STEPS, TVAStep } from '@/types/tva.types';
import { TvaMode } from '@/types/database.types';

// === Formatage ===
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    maximumFractionDigits: 2 
  }).format(value);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(num);
};

export const formatMonthYear = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [y, m] = dateStr.split('-');
  const months = ['Janv', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y}`;
};

export const formatFullMonth = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [y, m] = dateStr.split('-');
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return `${months[parseInt(m) - 1]} ${y}`;
};

// === TVA : Génération de la clé mois/année ===
export const getTVAKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// === TVA : Convertir tva_mode en régime simplifié ===
export const getTVARegime = (tvaMode: TvaMode | null): 'M' | 'T' | 'A' | 'N' => {
  if (!tvaMode) return 'M';
  switch (tvaMode) {
    case 'mensuel': return 'M';
    case 'trimestriel': return 'T';
    default: return 'M';
  }
};

// === TVA : Est-ce que ce dossier est actif pour ce mois ? ===
export const isDossierActiveForMonth = (regime: 'M' | 'T' | 'A' | 'N', date: Date): boolean => {
  const monthNum = date.getMonth() + 1;
  
  switch (regime) {
    case 'N': return false;  // Non-assujetti
    case 'M': return true;   // Mensuel = toujours actif
    case 'T': return [1, 4, 7, 10].includes(monthNum);  // Trimestriel
    case 'A': return monthNum === 5;  // Annuel (mai)
    default: return false;
  }
};

// === TVA : Vérifier si actif pour une période YYYY-MM ===
export const isDossierActiveForPeriod = (regime: 'M' | 'T' | 'A' | 'N', period: string): boolean => {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return isDossierActiveForMonth(regime, date);
};

// === TVA : Déterminer le statut d'un dossier ===
export const getTVAStatus = (history: TVAHistory | null, isActive: boolean): TVAStatus => {
  if (!isActive) return 'na';
  
  if (!history) return 'todo';
  
  if (history.step_valide) return 'done';
  
  const hasAnyStep = 
    history.step_compta_recue ||
    history.step_saisie_faite ||
    history.step_dossier_revise ||
    history.step_calcul_envoye ||
    history.step_teletransmis;
    
  if (hasAnyStep) return 'progress';
  
  return 'todo';
};

// === TVA : Compter les étapes validées ===
export const countCompletedSteps = (history: TVAHistory | null): number => {
  if (!history) return 0;
  
  let count = 0;
  TVA_STEPS.forEach(step => {
    if (history[step.key]) count++;
  });
  return count;
};

// === TVA : Obtenir la prochaine étape ===
export const getNextStep = (history: TVAHistory | null): TVAStep | null => {
  if (!history) return 'step_compta_recue';
  
  for (const step of TVA_STEPS) {
    if (!history[step.key]) return step.key;
  }
  return null;
};

// === TVA : Calcul du total à payer ===
export const calculateTotalTVA = (
  histories: (TVAHistory | null)[], 
  filterFn?: (h: TVAHistory) => boolean
): number => {
  return histories.reduce((sum, history) => {
    if (!history) return sum;
    if (filterFn && !filterFn(history)) return sum;
    return sum + (history.montant || 0);
  }, 0);
};

// === TVA : Calcul du total crédit ===
export const calculateTotalCredit = (
  histories: (TVAHistory | null)[]
): number => {
  return histories.reduce((sum, history) => {
    if (!history) return sum;
    return sum + (history.credit || 0);
  }, 0);
};

// === TVA : Générer les périodes pour une année ===
export const generateYearPeriods = (year: number): string[] => {
  return Array.from({ length: 12 }, (_, i) => 
    `${year}-${String(i + 1).padStart(2, '0')}`
  );
};

// === TVA : Période courante ===
export const getCurrentPeriod = (): string => {
  const now = new Date();
  return getTVAKey(now);
};

// === TVA : Période précédente ===
export const getPreviousPeriod = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
};

// === TVA : Couleur du statut ===
export const getStatusColor = (status: TVAStatus): string => {
  switch (status) {
    case 'done': return 'bg-green-500';
    case 'progress': return 'bg-amber-500';
    case 'todo': return 'bg-red-500';
    case 'na': return 'bg-muted';
    default: return 'bg-muted';
  }
};

export const getStatusBgClass = (status: TVAStatus): string => {
  switch (status) {
    case 'done': return 'bg-green-100 dark:bg-green-900/20';
    case 'progress': return 'bg-amber-100 dark:bg-amber-900/20';
    case 'todo': return 'bg-red-100 dark:bg-red-900/20';
    case 'na': return 'bg-muted/50';
    default: return 'bg-muted/50';
  }
};

export const getStatusLabel = (status: TVAStatus): string => {
  switch (status) {
    case 'done': return 'Validé';
    case 'progress': return 'En cours';
    case 'todo': return 'À faire';
    case 'na': return 'N/A';
    default: return '-';
  }
};

// === TVA : Régime label ===
export const getRegimeLabel = (regime: 'M' | 'T' | 'A' | 'N'): string => {
  switch (regime) {
    case 'M': return 'Mensuel';
    case 'T': return 'Trimestriel';
    case 'A': return 'Annuel';
    case 'N': return 'Non-assujetti';
    default: return '-';
  }
};

export const getRegimeShortLabel = (regime: 'M' | 'T' | 'A' | 'N'): string => {
  switch (regime) {
    case 'M': return 'M';
    case 'T': return 'T';
    case 'A': return 'A';
    case 'N': return 'N';
    default: return '-';
  }
};
