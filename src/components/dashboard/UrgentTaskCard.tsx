import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock, FileText, Receipt, Building2, Landmark } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TacheFiscale, Dossier, TacheType } from '@/types/database.types';

interface UrgentTaskCardProps {
  task: TacheFiscale;
  dossier: Dossier;
  onClick: () => void;
}

const taskTypeIcons: Record<TacheType, React.ElementType> = {
  TVA: Receipt,
  IS: FileText,
  CVAE: Building2,
  CFE: Landmark,
  LIASSE: FileText,
  AUTRE: FileText,
};

const taskTypeLabels: Record<TacheType, string> = {
  TVA: 'TVA',
  IS: 'Impôt sur les Sociétés',
  CVAE: 'CVAE',
  CFE: 'CFE',
  LIASSE: 'Liasse Fiscale',
  AUTRE: 'Autre',
};

type UrgencyLevel = 'late' | 'urgent' | 'soon' | 'done';

const getUrgencyLevel = (task: TacheFiscale): UrgencyLevel => {
  if (task.statut === 'fait') return 'done';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseISO(task.date_echeance);
  const daysUntilDue = differenceInDays(dueDate, today);
  
  if (daysUntilDue < 0) return 'late';
  if (daysUntilDue <= 7) return 'urgent';
  return 'soon';
};

const urgencyStyles: Record<UrgencyLevel, { bg: string; border: string; icon: string; badge: string }> = {
  late: {
    bg: 'bg-status-urgent/5',
    border: 'border-status-urgent/30',
    icon: 'text-status-urgent',
    badge: 'bg-status-urgent text-white',
  },
  urgent: {
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/30',
    icon: 'text-orange-500',
    badge: 'bg-orange-500 text-white',
  },
  soon: {
    bg: 'bg-status-todo/5',
    border: 'border-status-todo/30',
    icon: 'text-status-todo',
    badge: 'bg-status-todo text-white',
  },
  done: {
    bg: 'bg-status-done/5',
    border: 'border-status-done/30',
    icon: 'text-status-done',
    badge: 'bg-status-done text-white',
  },
};

export const UrgentTaskCard: React.FC<UrgentTaskCardProps> = ({
  task,
  dossier,
  onClick,
}) => {
  const Icon = taskTypeIcons[task.type] || FileText;
  const urgency = getUrgencyLevel(task);
  const styles = urgencyStyles[urgency];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseISO(task.date_echeance);
  const daysUntilDue = differenceInDays(dueDate, today);
  
  const getTimeLabel = () => {
    if (task.statut === 'fait') return 'Terminé';
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} jour(s) de retard`;
    if (daysUntilDue === 0) return "Aujourd'hui";
    if (daysUntilDue === 1) return 'Demain';
    return `Dans ${daysUntilDue} jours`;
  };

  const formattedDate = format(dueDate, 'd MMMM yyyy', { locale: fr });
  const monthLabel = format(dueDate, 'MMMM', { locale: fr });

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
        styles.bg,
        styles.border,
        'border-2'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-xl bg-background', styles.border)}>
          <Icon className={cn('w-5 h-5', styles.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm truncate">
                {taskTypeLabels[task.type]} {monthLabel}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {dossier.nom}
              </p>
            </div>
            <span className={cn('text-xs font-medium px-2 py-1 rounded-full shrink-0', styles.badge)}>
              {urgency === 'late' ? 'RETARD' : urgency === 'urgent' ? 'URGENT' : urgency === 'done' ? 'FAIT' : 'À FAIRE'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {urgency === 'late' ? (
                <AlertCircle className="w-3 h-3 text-status-urgent" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              <span>{formattedDate}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className={cn(
                urgency === 'late' && 'text-status-urgent font-medium',
                urgency === 'urgent' && 'text-orange-500 font-medium'
              )}>
                {getTimeLabel()}
              </span>
            </div>
            {task.statut !== 'fait' && (
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}>
                Déclarer
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
