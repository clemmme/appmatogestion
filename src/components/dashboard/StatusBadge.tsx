import React from 'react';
import { cn } from '@/lib/utils';
import type { TacheStatut } from '@/types/database.types';

interface StatusBadgeProps {
  statut: TacheStatut | null;
  montant?: number | null;
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<TacheStatut, { label: string; className: string }> = {
  a_faire: { label: 'À faire', className: 'status-todo' },
  fait: { label: 'Déclaré', className: 'status-done' },
  retard: { label: 'Retard', className: 'status-urgent' },
  credit: { label: 'Crédit', className: 'status-credit' },
  neant: { label: 'Néant', className: 'status-neant' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  statut,
  montant,
  compact = false,
  className,
}) => {
  if (!statut) {
    return (
      <span className={cn('status-badge status-empty', className)}>
        {compact ? '—' : 'Futur'}
      </span>
    );
  }

  const config = statusConfig[statut];

  const formatMontant = (value: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));

    return value < 0 ? `-${formatted}` : formatted;
  };

  return (
    <span className={cn('status-badge', config.className, className)}>
      {compact && montant !== null && montant !== undefined ? (
        <span className="font-mono text-xs">{formatMontant(montant)}</span>
      ) : (
        config.label
      )}
    </span>
  );
};
