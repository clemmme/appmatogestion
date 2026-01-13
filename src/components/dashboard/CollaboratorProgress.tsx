import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import type { TacheFiscale, Profile, Dossier } from '@/types/database.types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CollaboratorProgressProps {
  collaborators: Profile[];
  taches: TacheFiscale[];
  dossiers: Dossier[];
  currentMonth: string; // Format: YYYY-MM
}

interface CollaboratorStats {
  profile: Profile;
  total: number;
  done: number;
  late: number;
  percentage: number;
}

export const CollaboratorProgress: React.FC<CollaboratorProgressProps> = ({
  collaborators,
  taches,
  dossiers,
  currentMonth,
}) => {
  // Build dossier -> manager mapping
  const dossierManagerMap = new Map(dossiers.map(d => [d.id, d.manager_id]));

  // Calculate stats per collaborator
  const stats: CollaboratorStats[] = collaborators
    .map(profile => {
      // Get dossiers managed by this collaborator
      const managedDossierIds = new Set(
        dossiers.filter(d => d.manager_id === profile.id).map(d => d.id)
      );

      // Filter tasks for this collaborator's dossiers in current month
      const relevantTasks = taches.filter(t => {
        if (!managedDossierIds.has(t.dossier_id)) return false;
        return t.date_echeance.startsWith(currentMonth);
      });

      const total = relevantTasks.length;
      const done = relevantTasks.filter(t => t.statut === 'fait').length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const late = relevantTasks.filter(t => {
        if (t.statut === 'fait') return false;
        return new Date(t.date_echeance) < today;
      }).length;

      return {
        profile,
        total,
        done,
        late,
        percentage: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    })
    .filter(s => s.total > 0) // Only show collaborators with tasks
    .sort((a, b) => b.percentage - a.percentage);

  if (stats.length === 0) {
    return null;
  }

  const getProgressColor = (percentage: number, late: number) => {
    if (late > 0) return 'bg-status-urgent';
    if (percentage >= 80) return 'bg-status-done';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-status-todo';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Progression par collaborateur
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {format(new Date(currentMonth + '-01'), 'MMMM yyyy', { locale: undefined })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stats.map((stat) => (
            <div key={stat.profile.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(stat.profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{stat.profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stat.done}/{stat.total} tâches
                      {stat.late > 0 && (
                        <span className="text-status-urgent font-medium ml-1">
                          • {stat.late} en retard
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'text-sm font-bold',
                  stat.late > 0 && 'text-status-urgent',
                  stat.late === 0 && stat.percentage >= 80 && 'text-status-done',
                  stat.late === 0 && stat.percentage < 80 && 'text-muted-foreground'
                )}>
                  {stat.percentage}%
                </span>
              </div>
              <Progress 
                value={stat.percentage} 
                className={cn('h-2', stat.late > 0 && '[&>div]:bg-status-urgent')}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
