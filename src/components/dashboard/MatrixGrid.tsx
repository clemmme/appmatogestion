import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { TaskModal } from './TaskModal';
import type { Dossier, TacheFiscale, TacheType, TacheStatut } from '@/types/database.types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MatrixGridProps {
  dossiers: Dossier[];
  taches: TacheFiscale[];
  months: string[]; // Format: YYYY-MM
  taskType: TacheType;
  onTaskUpdate?: (task: TacheFiscale) => void;
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({
  dossiers,
  taches,
  months,
  taskType,
  onTaskUpdate,
}) => {
  const [selectedCell, setSelectedCell] = useState<{
    dossier: Dossier;
    month: string;
    task: TacheFiscale | null;
  } | null>(null);

  // Create a map for quick task lookup
  const taskMap = new Map<string, TacheFiscale>();
  taches.forEach((task) => {
    if (task.type === taskType) {
      const monthKey = task.date_echeance.substring(0, 7); // YYYY-MM
      const key = `${task.dossier_id}-${monthKey}`;
      taskMap.set(key, task);
    }
  });

  const getTask = (dossierId: string, month: string): TacheFiscale | null => {
    return taskMap.get(`${dossierId}-${month}`) || null;
  };

  const handleCellClick = (dossier: Dossier, month: string) => {
    const task = getTask(dossier.id, month);
    setSelectedCell({ dossier, month, task });
  };

  const formatMonth = (month: string) => {
    try {
      const date = parseISO(`${month}-01`);
      return format(date, 'MMM yy', { locale: fr });
    } catch {
      return month;
    }
  };

  return (
    <>
      <div className="overflow-auto rounded-lg border bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="matrix-header border-r px-4 py-3 text-left min-w-[200px] sticky left-0 bg-muted z-10">
                Dossier
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  className="matrix-header px-2 py-3 text-center min-w-[80px]"
                >
                  {formatMonth(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dossiers.map((dossier) => (
              <tr key={dossier.id} className="hover:bg-muted/50 transition-colors">
                <td className="border-r border-b px-4 py-2 sticky left-0 bg-card z-10">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm truncate max-w-[180px]">
                      {dossier.nom}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {dossier.forme_juridique} • {dossier.tva_mode}
                    </span>
                  </div>
                </td>
                {months.map((month) => {
                  const task = getTask(dossier.id, month);
                  const isPast = month < format(new Date(), 'yyyy-MM');
                  const isUrgent = task?.statut === 'retard' || 
                    (isPast && (!task || task.statut === 'a_faire'));

                  return (
                    <td
                      key={month}
                      className={cn(
                        'matrix-cell border-b cursor-pointer',
                        isUrgent && !task?.statut && 'bg-status-urgent/10'
                      )}
                      onClick={() => handleCellClick(dossier, month)}
                    >
                      <StatusBadge
                        statut={task?.statut || null}
                        montant={task?.montant}
                        compact
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {dossiers.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Aucun dossier à afficher
          </div>
        )}
      </div>

      {selectedCell && (
        <TaskModal
          open={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          dossier={selectedCell.dossier}
          month={selectedCell.month}
          task={selectedCell.task}
          taskType={taskType}
          onSave={(task) => {
            onTaskUpdate?.(task);
            setSelectedCell(null);
          }}
        />
      )}
    </>
  );
};
