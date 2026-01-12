import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MatrixGrid } from '@/components/dashboard/MatrixGrid';
import { StatsCard } from '@/components/dashboard/StatsCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FolderOpen, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import type { Dossier, TacheFiscale, TacheType, Branch } from '@/types/database.types';
import { format, subMonths, addMonths } from 'date-fns';

const generateMonths = (startOffset: number = -2, count: number = 14): string[] => {
  const months: string[] = [];
  const today = new Date();
  const start = subMonths(today, Math.abs(startOffset));

  for (let i = 0; i < count; i++) {
    months.push(format(addMonths(start, i), 'yyyy-MM'));
  }
  return months;
};

export const Dashboard: React.FC = () => {
  const { organization, branch, profile } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [taches, setTaches] = useState<TacheFiscale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [taskType, setTaskType] = useState<TacheType>('TVA');

  const months = generateMonths();

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (branchesData) {
        setBranches(branchesData as Branch[]);
      }

      // Fetch dossiers
      let dossiersQuery = supabase
        .from('dossiers')
        .select('*')
        .eq('is_active', true)
        .order('nom');

      if (selectedBranch !== 'all') {
        dossiersQuery = dossiersQuery.eq('branch_id', selectedBranch);
      }

      const { data: dossiersData } = await dossiersQuery;
      if (dossiersData) {
        setDossiers(dossiersData as Dossier[]);
      }

      // Fetch taches
      const { data: tachesData } = await supabase
        .from('taches_fiscales')
        .select('*')
        .order('date_echeance');

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
  };

  // Calculate stats
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthTasks = taches.filter(
    (t) => t.date_echeance.startsWith(currentMonth)
  );
  const completedTasks = currentMonthTasks.filter((t) => t.statut === 'fait').length;
  const pendingTasks = currentMonthTasks.filter((t) => t.statut === 'a_faire').length;
  const lateTasks = taches.filter((t) => t.statut === 'retard').length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">
            {organization?.name || 'Votre cabinet'} • Suivi des obligations fiscales
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les établissements" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les établissements</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Dossiers actifs"
          value={dossiers.length}
          subtitle="clients suivis"
          icon={FolderOpen}
          variant="default"
        />
        <StatsCard
          title="Déclarés ce mois"
          value={completedTasks}
          subtitle={`sur ${currentMonthTasks.length} tâches`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatsCard
          title="À traiter"
          value={pendingTasks}
          subtitle="ce mois-ci"
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="En retard"
          value={lateTasks}
          subtitle="à régulariser"
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Matrix View */}
      <div className="space-y-4">
        <Tabs value={taskType} onValueChange={(v) => setTaskType(v as TacheType)}>
          <TabsList>
            <TabsTrigger value="TVA">TVA</TabsTrigger>
            <TabsTrigger value="IS">IS</TabsTrigger>
            <TabsTrigger value="CVAE">CVAE</TabsTrigger>
            <TabsTrigger value="CFE">CFE</TabsTrigger>
            <TabsTrigger value="LIASSE">Liasses</TabsTrigger>
          </TabsList>

          <TabsContent value={taskType} className="mt-4">
            <MatrixGrid
              dossiers={dossiers}
              taches={taches}
              months={months}
              taskType={taskType}
              onTaskUpdate={handleTaskUpdate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
