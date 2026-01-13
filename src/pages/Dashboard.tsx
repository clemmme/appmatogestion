import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { UrgentTaskCard } from '@/components/dashboard/UrgentTaskCard';
import { ProductionDelays } from '@/components/dashboard/ProductionDelays';
import { CollaboratorProgress } from '@/components/dashboard/CollaboratorProgress';
import { DossierAccordion } from '@/components/dashboard/DossierAccordion';
import { TaskModal } from '@/components/dashboard/TaskModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Users,
  Receipt,
  FileText,
  Building2,
  Landmark,
  AlertTriangle
} from 'lucide-react';
import type { Dossier, TacheFiscale, TacheType, Branch, Profile } from '@/types/database.types';
import { format, parseISO, differenceInDays, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type UrgencyLevel = 'late' | 'urgent' | 'soon' | 'done';

const getTaskUrgency = (task: TacheFiscale): UrgencyLevel => {
  if (task.statut === 'fait') return 'done';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseISO(task.date_echeance);
  const daysUntilDue = differenceInDays(dueDate, today);
  
  if (daysUntilDue < 0) return 'late';
  if (daysUntilDue <= 5) return 'urgent';
  return 'soon';
};

const urgencyRowStyles: Record<UrgencyLevel, string> = {
  late: 'bg-status-urgent/10 hover:bg-status-urgent/15 border-l-4 border-l-status-urgent',
  urgent: 'bg-orange-500/10 hover:bg-orange-500/15 border-l-4 border-l-orange-500',
  soon: 'bg-status-todo/5 hover:bg-status-todo/10',
  done: 'bg-status-done/5 hover:bg-status-done/10',
};

const taskTypeConfig: Record<string, { icon: React.ElementType; label: string; filter: TacheType[] }> = {
  TVA: { icon: Receipt, label: 'TVA', filter: ['TVA'] },
  IS: { icon: FileText, label: 'IS', filter: ['IS'] },
  TAXES: { icon: Building2, label: 'Taxes Annexes', filter: ['CVAE', 'CFE', 'LIASSE'] },
};

export const Dashboard: React.FC = () => {
  const { organization, userRole } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [taches, setTaches] = useState<TacheFiscale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ACCORDION');
  const [selectedTask, setSelectedTask] = useState<{
    dossier: Dossier;
    month: string;
    task: TacheFiscale | null;
    taskType: TacheType;
  } | null>(null);

  const isExpert = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchData();
  }, [selectedBranch, selectedCollaborator]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isExpert) {
        const { data: branchesData } = await supabase
          .from('branches')
          .select('*')
          .order('name');

        if (branchesData) {
          setBranches(branchesData as Branch[]);
        }

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name');

        if (profilesData) {
          setCollaborators(profilesData as Profile[]);
        }
      }

      let dossiersQuery = supabase
        .from('dossiers')
        .select('*')
        .eq('is_active', true)
        .order('nom');

      if (selectedBranch !== 'all') {
        dossiersQuery = dossiersQuery.eq('branch_id', selectedBranch);
      }

      if (isExpert && selectedCollaborator !== 'all') {
        dossiersQuery = dossiersQuery.eq('manager_id', selectedCollaborator);
      }

      const { data: dossiersData } = await dossiersQuery;
      if (dossiersData) {
        setDossiers(dossiersData as Dossier[]);
      }

      const { data: tachesData } = await supabase
        .from('taches_fiscales')
        .select('*')
        .order('date_echeance', { ascending: true });

      if (tachesData) {
        setTaches(tachesData as TacheFiscale[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = (updatedTask: TacheFiscale) => {
    setTaches((prev) =>
      prev.some((t) => t.id === updatedTask.id)
        ? prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        : [...prev, updatedTask]
    );
    setSelectedTask(null);
  };

  const dossierMap = useMemo(() => {
    return new Map(dossiers.map(d => [d.id, d]));
  }, [dossiers]);

  const getFilteredTasks = (types: TacheType[]) => {
    const dossierIds = new Set(dossiers.map(d => d.id));
    return taches
      .filter(t => types.includes(t.type) && dossierIds.has(t.dossier_id))
      .sort((a, b) => {
        if (a.statut === 'fait' && b.statut !== 'fait') return 1;
        if (a.statut !== 'fait' && b.statut === 'fait') return -1;
        return new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime();
      });
  };

  // Get LATE tasks (deadline passed and not done) - CRITICAL
  const lateTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dossierIds = new Set(dossiers.map(d => d.id));

    return taches
      .filter(t => {
        if (!dossierIds.has(t.dossier_id)) return false;
        if (t.statut === 'fait' || t.statut === 'neant') return false;
        const dueDate = parseISO(t.date_echeance);
        return isBefore(dueDate, today);
      })
      .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime());
  }, [taches, dossiers]);

  // Get URGENT tasks (due within 5 days, not late)
  const urgentTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const urgentDeadline = addDays(today, 5);
    const dossierIds = new Set(dossiers.map(d => d.id));

    return taches
      .filter(t => {
        if (!dossierIds.has(t.dossier_id)) return false;
        if (t.statut === 'fait' || t.statut === 'neant') return false;
        const dueDate = parseISO(t.date_echeance);
        // Not late but within 5 days
        return !isBefore(dueDate, today) && isBefore(dueDate, urgentDeadline);
      })
      .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())
      .slice(0, 6);
  }, [taches, dossiers]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dossierIds = new Set(dossiers.map(d => d.id));
    const relevantTasks = taches.filter(t => dossierIds.has(t.dossier_id));
    
    const currentMonth = format(today, 'yyyy-MM');
    const currentMonthTasks = relevantTasks.filter(t => t.date_echeance.startsWith(currentMonth));
    
    return {
      activeDossiers: dossiers.length,
      completed: currentMonthTasks.filter(t => t.statut === 'fait').length,
      pending: currentMonthTasks.filter(t => t.statut === 'a_faire').length,
      late: lateTasks.length,
      total: currentMonthTasks.length,
    };
  }, [taches, dossiers, lateTasks]);

  const currentMonth = format(new Date(), 'yyyy-MM');

  const openTaskModal = (task: TacheFiscale) => {
    const dossier = dossierMap.get(task.dossier_id);
    if (dossier) {
      setSelectedTask({
        dossier,
        month: task.date_echeance.substring(0, 7),
        task,
        taskType: task.type,
      });
    }
  };

  const renderTaskTable = (types: TacheType[]) => {
    const filteredTasks = getFilteredTasks(types);

    if (filteredTasks.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune tâche à afficher</p>
          <p className="text-sm mt-2">Créez un dossier pour générer automatiquement les obligations fiscales</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Dossier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Échéance</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Délai</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Statut</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Montant</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const dossier = dossierMap.get(task.dossier_id);
                if (!dossier) return null;

                const urgency = getTaskUrgency(task);
                const dueDate = parseISO(task.date_echeance);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysUntilDue = differenceInDays(dueDate, today);

                const getDelayLabel = () => {
                  if (task.statut === 'fait') return '—';
                  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}j de retard`;
                  if (daysUntilDue === 0) return "Aujourd'hui";
                  if (daysUntilDue === 1) return 'Demain';
                  return `${daysUntilDue} jours`;
                };

                const getStatusBadge = () => {
                  if (task.statut === 'fait') {
                    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-status-done/10 text-status-done">Terminé</span>;
                  }
                  if (task.statut === 'credit') {
                    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-status-credit/10 text-status-credit">Crédit</span>;
                  }
                  if (task.statut === 'neant') {
                    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">Néant</span>;
                  }
                  if (urgency === 'late') {
                    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-status-urgent text-white">RETARD</span>;
                  }
                  if (urgency === 'urgent') {
                    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500 text-white">URGENT</span>;
                  }
                  return <span className="px-2 py-1 rounded-full text-xs font-medium bg-status-todo/10 text-status-todo">À faire</span>;
                };

                return (
                  <tr 
                    key={task.id} 
                    className={cn(
                      'cursor-pointer transition-colors',
                      urgencyRowStyles[urgency]
                    )}
                    onClick={() => openTaskModal(task)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{dossier.nom}</p>
                        <p className="text-xs text-muted-foreground">{dossier.forme_juridique}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{task.type}</td>
                    <td className="px-4 py-3 text-sm">
                      {format(dueDate, 'd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-sm',
                        urgency === 'late' && 'text-status-urgent font-semibold',
                        urgency === 'urgent' && 'text-orange-500 font-medium',
                      )}>
                        {getDelayLabel()}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge()}</td>
                    <td className="px-4 py-3 text-sm">
                      {task.montant ? `${task.montant.toLocaleString('fr-FR')} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {task.statut !== 'fait' && (
                        <Button size="sm" variant="secondary" onClick={(e) => {
                          e.stopPropagation();
                          openTaskModal(task);
                        }}>
                          Déclarer
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">
            {organization?.name || 'Votre cabinet'} • {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isExpert && (
            <>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous les établissements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les établissements</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="w-[180px]">
                  <Users className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tous les collaborateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les collaborateurs</SelectItem>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Dossiers actifs"
          value={stats.activeDossiers}
          subtitle="clients suivis"
          icon={FolderOpen}
          variant="default"
        />
        <StatsCard
          title="Déclarés ce mois"
          value={stats.completed}
          subtitle={`sur ${stats.total} tâches`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatsCard
          title="À traiter"
          value={stats.pending}
          subtitle="ce mois-ci"
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="En retard"
          value={stats.late}
          subtitle="à régulariser"
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Production Delays Alert - Top Priority */}
      <ProductionDelays
        lateTasks={lateTasks}
        dossierMap={dossierMap}
        onTaskClick={openTaskModal}
      />

      {/* Expert View: Collaborator Progress */}
      {isExpert && collaborators.length > 0 && (
        <CollaboratorProgress
          collaborators={collaborators}
          taches={taches}
          dossiers={dossiers}
          currentMonth={currentMonth}
        />
      )}

      {/* Urgent Tasks Cards */}
      {urgentTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Échéances urgentes (5 jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urgentTasks.map((task) => {
                const dossier = dossierMap.get(task.dossier_id);
                if (!dossier) return null;
                return (
                  <UrgentTaskCard
                    key={task.id}
                    task={task}
                    dossier={dossier}
                    onClick={() => openTaskModal(task)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role indicator for non-experts */}
      {!isExpert && (
        <div className="bg-muted/50 border rounded-lg p-3 text-sm text-muted-foreground">
          <strong>Vue collaborateur :</strong> Vous voyez uniquement les dossiers qui vous sont assignés.
        </div>
      )}

      {/* Dossiers Accordion View */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Vue par dossier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="ACCORDION" className="gap-2">
                Vue Accordéon
              </TabsTrigger>
              <TabsTrigger value="TVA" className="gap-2">
                <Receipt className="w-4 h-4" />
                TVA
              </TabsTrigger>
              <TabsTrigger value="IS" className="gap-2">
                <FileText className="w-4 h-4" />
                IS
              </TabsTrigger>
              <TabsTrigger value="TAXES" className="gap-2">
                <Building2 className="w-4 h-4" />
                Taxes Annexes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ACCORDION" className="mt-0">
              <DossierAccordion
                dossiers={dossiers}
                taches={taches}
                onTaskClick={openTaskModal}
              />
            </TabsContent>

            <TabsContent value="TVA" className="mt-0">
              {renderTaskTable(['TVA'])}
            </TabsContent>

            <TabsContent value="IS" className="mt-0">
              {renderTaskTable(['IS'])}
            </TabsContent>

            <TabsContent value="TAXES" className="mt-0">
              {renderTaskTable(['CVAE', 'CFE', 'LIASSE'])}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          dossier={selectedTask.dossier}
          month={selectedTask.month}
          task={selectedTask.task}
          taskType={selectedTask.taskType}
          onSave={handleTaskUpdate}
        />
      )}
    </div>
  );
};

export default Dashboard;
