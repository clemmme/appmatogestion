import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { TacheFiscale, Dossier } from '@/types/database.types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProductionDelaysProps {
  lateTasks: TacheFiscale[];
  dossierMap: Map<string, Dossier>;
  onTaskClick: (task: TacheFiscale) => void;
}

export const ProductionDelays: React.FC<ProductionDelaysProps> = ({
  lateTasks,
  dossierMap,
  onTaskClick,
}) => {
  if (lateTasks.length === 0) {
    return null;
  }

  return (
    <Card className="border-status-urgent/30 bg-status-urgent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-status-urgent">
          <div className="relative">
            <AlertTriangle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-status-urgent rounded-full animate-ping" />
          </div>
          Retards de Production
          <span className="ml-auto text-sm font-normal bg-status-urgent text-white px-2 py-0.5 rounded-full">
            {lateTasks.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lateTasks.slice(0, 10).map((task) => {
            const dossier = dossierMap.get(task.dossier_id);
            if (!dossier) return null;

            const dueDate = parseISO(task.date_echeance);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysLate = differenceInDays(today, dueDate);

            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg cursor-pointer',
                  'bg-white/50 hover:bg-white border border-status-urgent/20',
                  'transition-all hover:shadow-md',
                  daysLate > 30 && 'animate-pulse'
                )}
                onClick={() => onTaskClick(task)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-status-urgent/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-status-urgent">{task.type}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{dossier.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.commentaire || `${task.type} - ${format(dueDate, 'MMM yyyy', { locale: fr })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-status-urgent">
                      {daysLate}j de retard
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Limite : {format(dueDate, 'd MMM', { locale: fr })}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="text-status-urgent">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {lateTasks.length > 10 && (
            <p className="text-center text-sm text-muted-foreground pt-2">
              + {lateTasks.length - 10} autres retards
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
