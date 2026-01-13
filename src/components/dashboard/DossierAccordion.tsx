import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import type { Dossier, TacheFiscale } from '@/types/database.types';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DossierAccordionProps {
  dossiers: Dossier[];
  taches: TacheFiscale[];
  onTaskClick: (task: TacheFiscale) => void;
}

export const DossierAccordion: React.FC<DossierAccordionProps> = ({
  dossiers,
  taches,
  onTaskClick,
}) => {
  const navigate = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group tasks by dossier
  const dossierTasksMap = React.useMemo(() => {
    const map = new Map<string, TacheFiscale[]>();
    taches.forEach((task) => {
      const existing = map.get(task.dossier_id) || [];
      existing.push(task);
      map.set(task.dossier_id, existing);
    });
    return map;
  }, [taches]);

  const getTaskStats = (dossierId: string) => {
    const tasks = dossierTasksMap.get(dossierId) || [];
    const pending = tasks.filter((t) => t.statut === 'a_faire' || t.statut === 'retard');
    const late = tasks.filter((t) => {
      if (t.statut === 'fait' || t.statut === 'neant') return false;
      return isBefore(parseISO(t.date_echeance), today);
    });
    const done = tasks.filter((t) => t.statut === 'fait');

    return { total: tasks.length, pending: pending.length, late: late.length, done: done.length };
  };

  const getUrgencyStyle = (stats: { late: number }) => {
    if (stats.late > 0) {
      return 'border-l-4 border-l-status-urgent bg-status-urgent/5';
    }
    return '';
  };

  // Sort dossiers: those with late tasks first
  const sortedDossiers = React.useMemo(() => {
    return [...dossiers].sort((a, b) => {
      const statsA = getTaskStats(a.id);
      const statsB = getTaskStats(b.id);
      if (statsA.late > 0 && statsB.late === 0) return -1;
      if (statsA.late === 0 && statsB.late > 0) return 1;
      return a.nom.localeCompare(b.nom);
    });
  }, [dossiers, dossierTasksMap]);

  if (sortedDossiers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucun dossier à afficher</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {sortedDossiers.map((dossier) => {
        const stats = getTaskStats(dossier.id);
        const tasks = dossierTasksMap.get(dossier.id) || [];
        
        // Filter and sort pending tasks by due date
        const pendingTasks = tasks
          .filter((t) => t.statut !== 'fait' && t.statut !== 'neant')
          .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime());

        return (
          <AccordionItem
            key={dossier.id}
            value={dossier.id}
            className={cn(
              'border rounded-lg px-4 bg-card transition-all',
              getUrgencyStyle(stats)
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  {stats.late > 0 ? (
                    <AlertCircle className="w-5 h-5 text-status-urgent animate-pulse" />
                  ) : stats.pending > 0 ? (
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-status-done" />
                  )}
                  <div className="text-left">
                    <p className="font-medium">{dossier.nom}</p>
                    <p className="text-sm text-muted-foreground">
                      {dossier.forme_juridique} • TVA {dossier.tva_mode}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {stats.late > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {stats.late} retard{stats.late > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {stats.pending > 0 && stats.late === 0 && (
                    <Badge variant="secondary">
                      {stats.pending} à traiter
                    </Badge>
                  )}
                  {stats.done > 0 && (
                    <Badge variant="outline" className="bg-status-done/10 text-status-done border-status-done/30">
                      {stats.done} fait{stats.done > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="pt-2 pb-4 space-y-3">
                {/* Quick access button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dossiers/${dossier.id}`);
                  }}
                  className="mb-3"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Ouvrir la feuille de travail
                </Button>

                {/* Task list */}
                {pendingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Toutes les tâches sont à jour ✓
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingTasks.map((task) => {
                      const dueDate = parseISO(task.date_echeance);
                      const daysUntilDue = differenceInDays(dueDate, today);
                      const isLate = daysUntilDue < 0;
                      const isUrgent = daysUntilDue >= 0 && daysUntilDue <= 5;

                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task)}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                            isLate && 'bg-status-urgent/10 border-status-urgent/30 hover:bg-status-urgent/15',
                            isUrgent && !isLate && 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15',
                            !isLate && !isUrgent && 'hover:bg-muted'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{task.type}</Badge>
                            <span className="text-sm">{task.commentaire || task.type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'text-sm',
                              isLate && 'text-status-urgent font-semibold',
                              isUrgent && !isLate && 'text-orange-500 font-medium'
                            )}>
                              {isLate
                                ? `${Math.abs(daysUntilDue)}j de retard`
                                : daysUntilDue === 0
                                  ? "Aujourd'hui"
                                  : `${daysUntilDue}j`}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {format(dueDate, 'd MMM', { locale: fr })}
                            </span>
                            <Button size="sm" variant="secondary">
                              Déclarer
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
