import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Calendar, Save, RefreshCw, ListChecks, Table } from 'lucide-react';
import type { Dossier, TacheFiscale, TacheType, TacheStatut } from '@/types/database.types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TVAWorkflowGrid } from '@/components/tva/TVAWorkflowGrid';

type YearMonth = string; // Format: YYYY-MM

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// IS has 5 specific periods, not 12 months
const IS_PERIODS = [
  { key: 'acompte1', label: 'Acompte 1', month: 3 },
  { key: 'acompte2', label: 'Acompte 2', month: 6 },
  { key: 'acompte3', label: 'Acompte 3', month: 9 },
  { key: 'acompte4', label: 'Acompte 4', month: 12 },
  { key: 'solde', label: 'Solde IS', month: 5 },
];

const TASK_TYPES: TacheType[] = ['TVA', 'IS', 'CFE', 'CVAE', 'LIASSE'];

const STATUS_OPTIONS: { value: TacheStatut; label: string; color: string }[] = [
  { value: 'a_faire', label: 'À faire', color: 'bg-status-todo/20 text-status-todo' },
  { value: 'fait', label: 'Fait', color: 'bg-status-done/20 text-status-done' },
  { value: 'credit', label: 'Crédit', color: 'bg-status-credit/20 text-status-credit' },
  { value: 'neant', label: 'Néant', color: 'bg-muted text-muted-foreground' },
  { value: 'retard', label: 'Retard', color: 'bg-status-urgent/20 text-status-urgent' },
];

export const DossierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [taches, setTaches] = useState<TacheFiscale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [pendingChanges, setPendingChanges] = useState<Map<string, { montant?: number; statut?: TacheStatut }>>(new Map());

  // Extended year range to allow historical data entry
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }, []);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, selectedYear]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dossierRes, tachesRes] = await Promise.all([
        supabase.from('dossiers').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('taches_fiscales')
          .select('*')
          .eq('dossier_id', id)
          .gte('date_echeance', `${selectedYear}-01-01`)
          .lte('date_echeance', `${selectedYear}-12-31`)
          .order('date_echeance'),
      ]);

      if (dossierRes.data) setDossier(dossierRes.data as Dossier);
      if (tachesRes.data) setTaches(tachesRes.data as TacheFiscale[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Build a map of tasks by type and month
  const taskMatrix = useMemo(() => {
    const matrix: Record<TacheType, Record<string, TacheFiscale | null>> = {} as any;
    
    TASK_TYPES.forEach(type => {
      matrix[type] = {};
      for (let month = 1; month <= 12; month++) {
        const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
        matrix[type][key] = null;
      }
    });

    taches.forEach(task => {
      const monthKey = task.date_echeance.substring(0, 7);
      if (matrix[task.type]) {
        matrix[task.type][monthKey] = task;
      }
    });

    return matrix;
  }, [taches, selectedYear]);

  const handleCellChange = (taskId: string | null, type: TacheType, month: string, field: 'montant' | 'statut', value: number | TacheStatut) => {
    if (!taskId) {
      // No task exists for this cell - we could create one, but for now just ignore
      toast.info('Aucune tâche n\'existe pour cette période');
      return;
    }

    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(taskId) || {};
      newMap.set(taskId, { ...existing, [field]: value });
      return newMap;
    });

    // Update local state for immediate feedback
    setTaches(prev => prev.map(t => {
      if (t.id === taskId) {
        if (field === 'montant') {
          return { ...t, montant: value as number };
        } else {
          return { ...t, statut: value as TacheStatut };
        }
      }
      return t;
    }));
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info('Aucune modification à enregistrer');
      return;
    }

    setSaving(true);
    try {
      const updates = Array.from(pendingChanges.entries()).map(([taskId, changes]) => ({
        id: taskId,
        ...changes,
        ...(changes.statut === 'fait' ? { completed_at: new Date().toISOString() } : {}),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('taches_fiscales')
          .update(update)
          .eq('id', update.id);
        
        if (error) throw error;
      }

      setPendingChanges(new Map());
      toast.success(`${updates.length} modification(s) enregistrée(s)`);
      fetchData();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getCellStyle = (task: TacheFiscale | null) => {
    if (!task) return 'bg-muted/30';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseISO(task.date_echeance);
    
    if (task.statut === 'fait') return 'bg-status-done/10 border-status-done/30';
    if (task.statut === 'credit') return 'bg-status-credit/10 border-status-credit/30';
    if (task.statut === 'neant') return 'bg-muted/50';
    
    if (dueDate < today) return 'bg-status-urgent/15 border-status-urgent/30';
    
    const daysUntil = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 5) return 'bg-orange-500/10 border-orange-500/30';
    
    return 'bg-card';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/dossiers')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux dossiers
        </Button>
        <div className="mt-8 text-center text-muted-foreground">
          Dossier non trouvé
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dossiers')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              {dossier.nom}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{dossier.forme_juridique}</Badge>
              <Badge variant="secondary">{dossier.regime_fiscal}</Badge>
              <Badge variant={dossier.tva_mode === 'mensuel' ? 'default' : 'outline'}>
                TVA {dossier.tva_mode}
              </Badge>
              {dossier.siren && (
                <span className="text-sm text-muted-foreground font-mono">{dossier.siren}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Prominent year selector */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {years.map(year => (
              <Button
                key={year}
                variant={selectedYear === year ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedYear(year)}
                className="min-w-[60px]"
              >
                {year}
              </Button>
            ))}
          </div>

          <Button onClick={saveChanges} disabled={saving || pendingChanges.size === 0}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Sauvegarde...' : `Enregistrer (${pendingChanges.size})`}
          </Button>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflow" className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            TVA Workflow
          </TabsTrigger>
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            Grille classique
          </TabsTrigger>
        </TabsList>

        {/* New TVA Workflow Tab */}
        <TabsContent value="workflow">
          <TVAWorkflowGrid
            dossierId={id!}
            tvaMode={dossier.tva_mode}
            year={selectedYear}
            onYearChange={setSelectedYear}
          />
        </TabsContent>

        {/* Classic Grid Tab */}
        <TabsContent value="grid">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fiche de travail {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="overflow-x-auto">
            {/* TVA Grid - Monthly */}
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">TVA (Mensuel/Trimestriel)</h3>
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-sm font-medium text-muted-foreground border-b sticky left-0 bg-muted/50 z-10 min-w-[80px]">
                    Période
                  </th>
                  <th className="text-center px-2 py-2 text-sm font-medium border-b border-l">Montant</th>
                  <th className="text-center px-2 py-2 text-sm font-medium border-b">Statut</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((monthName, idx) => {
                  const monthNum = idx + 1;
                  const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
                  const task = taskMatrix['TVA']?.[monthKey];
                  const cellStyle = getCellStyle(task);
                  
                  return (
                    <tr key={monthKey} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-sm border-b sticky left-0 bg-card z-10">
                        {monthName}
                      </td>
                      <td className={cn('border-b border-l p-1', cellStyle)}>
                        <Input
                          type="number"
                          placeholder="—"
                          className="h-8 text-sm text-center w-[120px]"
                          value={task?.montant || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : 0;
                            handleCellChange(task?.id || null, 'TVA', monthKey, 'montant', val);
                          }}
                          disabled={!task}
                        />
                      </td>
                      <td className={cn('border-b p-1', cellStyle)}>
                        <Select
                          value={task?.statut || ''}
                          onValueChange={(v) => handleCellChange(task?.id || null, 'TVA', monthKey, 'statut', v as TacheStatut)}
                          disabled={!task}
                        >
                          <SelectTrigger className="h-8 text-xs w-[100px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className={cn('px-1.5 py-0.5 rounded text-xs', opt.color)}>
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* IS Grid - 5 periods only */}
            {dossier.regime_fiscal === 'IS' && (
              <>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Impôt sur les Sociétés (IS)</h3>
                <table className="w-full border-collapse mb-6">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 text-sm font-medium text-muted-foreground border-b min-w-[150px]">
                        Échéance
                      </th>
                      <th className="text-center px-2 py-2 text-sm font-medium border-b border-l">Montant</th>
                      <th className="text-center px-2 py-2 text-sm font-medium border-b">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Find all IS tasks for this year
                      const isTasks = taches.filter(t => t.type === 'IS');
                      
                      return IS_PERIODS.map((period) => {
                        // Match task by commentaire containing the period label
                        const task = isTasks.find(t => 
                          t.commentaire?.includes(period.label.replace('Acompte ', 'Acompte IS ')) ||
                          t.commentaire?.includes(period.label)
                        );
                        const cellStyle = getCellStyle(task || null);
                        
                        return (
                          <tr key={period.key} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 font-medium text-sm border-b">
                              {period.label}
                              <span className="text-xs text-muted-foreground ml-2">
                                (15/{String(period.month).padStart(2, '0')})
                              </span>
                            </td>
                            <td className={cn('border-b border-l p-1', cellStyle)}>
                              <Input
                                type="number"
                                placeholder="—"
                                className="h-8 text-sm text-center w-[120px]"
                                value={task?.montant || ''}
                                onChange={(e) => {
                                  if (!task) return;
                                  const val = e.target.value ? Number(e.target.value) : 0;
                                  handleCellChange(task.id, 'IS', '', 'montant', val);
                                }}
                                disabled={!task}
                              />
                            </td>
                            <td className={cn('border-b p-1', cellStyle)}>
                              <Select
                                value={task?.statut || ''}
                                onValueChange={(v) => {
                                  if (!task) return;
                                  handleCellChange(task.id, 'IS', '', 'statut', v as TacheStatut);
                                }}
                                disabled={!task}
                              >
                                <SelectTrigger className="h-8 text-xs w-[100px]">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <span className={cn('px-1.5 py-0.5 rounded text-xs', opt.color)}>
                                        {opt.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </>
            )}

            {/* Other taxes (CFE, CVAE, LIASSE) */}
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Autres obligations</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-sm font-medium text-muted-foreground border-b min-w-[150px]">
                    Obligation
                  </th>
                  <th className="text-center px-2 py-2 text-sm font-medium border-b border-l">Montant</th>
                  <th className="text-center px-2 py-2 text-sm font-medium border-b">Statut</th>
                </tr>
              </thead>
              <tbody>
                {(['CFE', 'CVAE', 'LIASSE'] as TacheType[]).map((type) => {
                  const task = taches.find(t => t.type === type);
                  const cellStyle = getCellStyle(task || null);
                  
                  return (
                    <tr key={type} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-sm border-b">
                        {type === 'LIASSE' ? 'Bilan / Liasse Fiscale' : type}
                        {task && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Échéance: {format(parseISO(task.date_echeance), 'd MMM yyyy', { locale: fr })})
                          </span>
                        )}
                      </td>
                      <td className={cn('border-b border-l p-1', cellStyle)}>
                        <Input
                          type="number"
                          placeholder="—"
                          className="h-8 text-sm text-center w-[120px]"
                          value={task?.montant || ''}
                          onChange={(e) => {
                            if (!task) return;
                            const val = e.target.value ? Number(e.target.value) : 0;
                            handleCellChange(task.id, type, '', 'montant', val);
                          }}
                          disabled={!task}
                        />
                      </td>
                      <td className={cn('border-b p-1', cellStyle)}>
                        <Select
                          value={task?.statut || ''}
                          onValueChange={(v) => {
                            if (!task) return;
                            handleCellChange(task.id, type, '', 'statut', v as TacheStatut);
                          }}
                          disabled={!task}
                        >
                          <SelectTrigger className="h-8 text-xs w-[100px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className={cn('px-1.5 py-0.5 rounded text-xs', opt.color)}>
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {taches.length === 0 && (
            <div className="mt-4 p-4 text-center text-muted-foreground bg-muted/30 rounded-lg">
              Aucune obligation fiscale générée pour {selectedYear}. 
              Les tâches sont créées automatiquement à la création du dossier.
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-status-urgent/15 border border-status-urgent/30" />
          <span>En retard</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500/10 border border-orange-500/30" />
          <span>Urgent (5 jours)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-status-done/10 border border-status-done/30" />
          <span>Terminé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-status-credit/10 border border-status-credit/30" />
          <span>Crédit TVA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/50" />
          <span>Néant</span>
        </div>
      </div>
    </div>
  );
};

export default DossierDetail;
