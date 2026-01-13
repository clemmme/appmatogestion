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
import { FileSpreadsheet, AlertCircle, Clock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { Dossier, TacheFiscale } from '@/types/database.types';
import { format, parseISO, differenceInDays, isBefore, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DossierAccordionProps {
  dossiers: Dossier[];
  taches: TacheFiscale[];
  onTaskClick: (task: TacheFiscale) => void;
  showFutureTasks?: boolean;
}

/**
 * Visibility rules for tasks:
 * - TVA: Show only when today > last day of the period month
 *   (e.g., TVA January shows from February 1st)
 * - IS: Show when today >= due date - 30 days
 *   (e.g., IS due June 15 shows from May 16)
 */
const isTaskVisible = (task: TacheFiscale): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseISO(task.date_echeance);

  // Already completed tasks are always visible
  if (task.statut === 'fait' || task.statut === 'neant') {
    return true;
  }

  if (task.type === 'TVA') {
    // TVA logic: visible only after the period month ends
    // The due date is in month M+1, so the period is M
    // We show the task when today > last day of month M-1 (i.e., we're in or past month M)
    const periodMonth = new Date(dueDate);
    periodMonth.setMonth(periodMonth.getMonth() - 1); // Go back to the period month
    const lastDayOfPeriod = endOfMonth(periodMonth);
    return isBefore(lastDayOfPeriod, today);
  }

  if (task.type === 'IS') {
    // IS logic: visible when today >= due date - 30 days
    const visibilityDate = subDays(dueDate, 30);
    return today >= visibilityDate;
  }

  // Other taxes (CFE, CVAE, LIASSE): visible when today >= due date - 30 days
  const visibilityDate = subDays(dueDate, 30);
  return today >= visibilityDate;
};

export const DossierAccordion: React.FC<DossierAccordionProps> = ({
  dossiers,
  taches,
  onTaskClick,
  showFutureTasks = false,
}) => {
  const navigate = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group tasks by dossier, applying visibility filter
  const dossierTasksMap = React.useMemo(() => {
    const map = new Map<string, { visible: TacheFiscale[]; future: TacheFiscale[] }>();
    taches.forEach((task) => {
      const dossierId = task.dossier_id;
      const existing = map.get(dossierId) || { visible: [], future: [] };
      
      if (isTaskVisible(task)) {
        existing.visible.push(task);
      } else {
        existing.future.push(task);
      }
      
      map.set(dossierId, existing);
    });
    return map;
  }, [taches]);

  const getTaskStats = (dossierId: string) => {
    const taskData = dossierTasksMap.get(dossierId) || { visible: [], future: [] };
    const tasks = showFutureTasks ? [...taskData.visible, ...taskData.future] : taskData.visible;
    
    const pending = tasks.filter((t) => t.statut === 'a_faire' || t.statut === 'retard');
    const late = tasks.filter((t) => {
      if (t.statut === 'fait' || t.statut === 'neant') return false;
      return isBefore(parseISO(t.date_echeance), today);
    });
    const done = tasks.filter((t) => t.statut === 'fait');
    const futureCount = taskData.future.length;

    return { total: tasks.length, pending: pending.length, late: late.length, done: done.length, future: futureCount };
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
  }, [dossiers, dossierTasksMap, showFutureTasks]);

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
        const taskData = dossierTasksMap.get(dossier.id) || { visible: [], future: [] };
        const tasksToShow = showFutureTasks ? [...taskData.visible, ...taskData.future] : taskData.visible;
        
        // Filter and sort pending tasks by due date
        const pendingTasks = tasksToShow
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
                      const isFuture = !isTaskVisible(task);

                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task)}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                            isLate && 'bg-status-urgent/10 border-status-urgent/30 hover:bg-status-urgent/15',
                            isUrgent && !isLate && 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15',
                            isFuture && 'bg-muted/30 border-dashed opacity-60',
                            !isLate && !isUrgent && !isFuture && 'hover:bg-muted'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={isFuture ? "outline" : "default"} className={isFuture ? "opacity-50" : ""}>
                              {task.type}
                            </Badge>
                            <span className="text-sm">{task.commentaire || task.type}</span>
                            {isFuture && (
                              <Badge variant="outline" className="text-xs bg-muted">
                                <EyeOff className="w-3 h-3 mr-1" />
                                Prévisionnel
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'text-sm',
                              isLate && 'text-status-urgent font-semibold',
                              isUrgent && !isLate && 'text-orange-500 font-medium',
                              isFuture && 'text-muted-foreground'
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
                            {!isFuture && (
                              <Button size="sm" variant="secondary">
                                Déclarer
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Future tasks indicator */}
                {!showFutureTasks && stats.future > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      {stats.future} tâche{stats.future > 1 ? 's' : ''} prévisionnelle{stats.future > 1 ? 's' : ''} masquée{stats.future > 1 ? 's' : ''}
                    </p>
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
