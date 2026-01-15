import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, ChevronLeft, ChevronRight, Euro, MessageSquare, RefreshCw } from 'lucide-react';
import { useTVAHistory } from '@/hooks/useTVAHistory';
import { 
  TVA_STEPS, 
  TVAHistory, 
  TVAStep,
} from '@/types/tva.types';
import {
  formatMonthYear,
  formatCurrency,
  getTVARegime,
  isDossierActiveForPeriod,
  getTVAStatus,
  countCompletedSteps,
  getStatusColor,
  getStatusBgClass,
  generateYearPeriods,
} from '@/lib/tva-utils';
import { TvaMode } from '@/types/database.types';
import { cn } from '@/lib/utils';

interface TVAWorkflowGridProps {
  dossierId: string;
  tvaMode: TvaMode | null;
  year: number;
  onYearChange: (year: number) => void;
}

export const TVAWorkflowGrid: React.FC<TVAWorkflowGridProps> = ({
  dossierId,
  tvaMode,
  year,
  onYearChange,
}) => {
  const { history, isLoading, toggleStep, updateDetails, isUpdating } = useTVAHistory({
    dossierId,
    year,
  });

  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [editMontant, setEditMontant] = useState<string>('');
  const [editCredit, setEditCredit] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  const regime = getTVARegime(tvaMode);
  const periods = generateYearPeriods(year);

  // Build history map for quick lookup
  const historyMap = useMemo(() => {
    const map: Record<string, TVAHistory> = {};
    history.forEach(h => {
      map[h.period] = h;
    });
    return map;
  }, [history]);

  // Get active periods based on regime
  const activePeriods = useMemo(() => {
    return periods.filter(period => isDossierActiveForPeriod(regime, period));
  }, [periods, regime]);

  const handleStepToggle = async (period: string, step: TVAStep, currentValue: boolean) => {
    await toggleStep({
      dossierId,
      period,
      step,
      value: !currentValue,
    });
  };

  const openEditDialog = (period: string) => {
    const h = historyMap[period];
    setEditMontant(h?.montant?.toString() || '0');
    setEditCredit(h?.credit?.toString() || '0');
    setEditNote(h?.note || '');
    setEditingPeriod(period);
  };

  const saveDetails = async () => {
    if (!editingPeriod) return;
    
    await updateDetails({
      dossierId,
      period: editingPeriod,
      montant: parseFloat(editMontant) || 0,
      credit: parseFloat(editCredit) || 0,
      note: editNote,
    });
    
    setEditingPeriod(null);
  };

  // Calculate totals
  const totals = useMemo(() => {
    let montant = 0;
    let credit = 0;
    let done = 0;
    let inProgress = 0;
    let todo = 0;

    activePeriods.forEach(period => {
      const h = historyMap[period];
      if (h) {
        montant += h.montant || 0;
        credit += h.credit || 0;
        
        const status = getTVAStatus(h, true);
        if (status === 'done') done++;
        else if (status === 'progress') inProgress++;
        else todo++;
      } else {
        todo++;
      }
    });

    return { montant, credit, done, inProgress, todo, total: activePeriods.length };
  }, [activePeriods, historyMap]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Suivi TVA - Workflow 6 étapes
            <Badge variant="outline" className="ml-2">
              {regime === 'M' ? 'Mensuel' : regime === 'T' ? 'Trimestriel' : regime}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onYearChange(year - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-lg min-w-[60px] text-center">{year}</span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onYearChange(year + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Validé: {totals.done}/{totals.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>En cours: {totals.inProgress}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>À faire: {totals.todo}</span>
          </div>
          <div className="ml-auto font-medium">
            Total: {formatCurrency(totals.montant - totals.credit)}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium border-b min-w-[100px]">
                  Période
                </th>
                {TVA_STEPS.map(step => (
                  <TooltipProvider key={step.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <th className="text-center px-1 py-2 font-medium border-b border-l min-w-[40px]">
                          {step.shortLabel}
                        </th>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{step.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                <th className="text-right px-3 py-2 font-medium border-b border-l min-w-[100px]">
                  Montant
                </th>
                <th className="text-center px-2 py-2 font-medium border-b border-l">
                  <MessageSquare className="w-4 h-4 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map(period => {
                const isActive = isDossierActiveForPeriod(regime, period);
                const h = historyMap[period];
                const status = getTVAStatus(h, isActive);
                const completedCount = countCompletedSteps(h);
                
                if (!isActive) {
                  return (
                    <tr key={period} className="opacity-30">
                      <td className="px-3 py-2 text-muted-foreground border-b">
                        {formatMonthYear(period)}
                      </td>
                      <td colSpan={8} className="text-center text-xs text-muted-foreground border-b">
                        N/A
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr 
                    key={period} 
                    className={cn(
                      'transition-colors hover:bg-muted/30',
                      getStatusBgClass(status)
                    )}
                  >
                    <td className="px-3 py-2 font-medium border-b">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', getStatusColor(status))} />
                        {formatMonthYear(period)}
                      </div>
                    </td>
                    
                    {TVA_STEPS.map(step => {
                      const isChecked = h?.[step.key] ?? false;
                      
                      return (
                        <td 
                          key={step.key} 
                          className="text-center border-b border-l p-1"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleStepToggle(period, step.key, isChecked)}
                            disabled={isUpdating}
                            className={cn(
                              'transition-all',
                              isChecked && 'bg-primary border-primary'
                            )}
                          />
                        </td>
                      );
                    })}
                    
                    <td className="text-right px-3 py-2 font-mono border-b border-l">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => openEditDialog(period)}
                          >
                            <Euro className="w-3 h-3 mr-1" />
                            {h?.montant ? formatCurrency(h.montant) : '—'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>TVA {formatMonthYear(period)}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div>
                              <label className="text-sm font-medium mb-1 block">Montant TVA à payer</label>
                              <Input
                                type="number"
                                value={editMontant}
                                onChange={(e) => setEditMontant(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Crédit de TVA</label>
                              <Input
                                type="number"
                                value={editCredit}
                                onChange={(e) => setEditCredit(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Note</label>
                              <Textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="Notes sur cette période..."
                                rows={3}
                              />
                            </div>
                            <Button 
                              onClick={saveDetails} 
                              className="w-full"
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                    
                    <td className="text-center border-b border-l p-1">
                      {h?.note && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[200px]">{h.note}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            
            {/* Footer with totals */}
            <tfoot>
              <tr className="bg-muted/50 font-medium">
                <td className="px-3 py-2 border-t">Total</td>
                <td colSpan={6} className="text-center border-t border-l">
                  {totals.done}/{totals.total} validés
                </td>
                <td className="text-right px-3 py-2 font-mono border-t border-l">
                  {formatCurrency(totals.montant)}
                </td>
                <td className="border-t border-l" />
              </tr>
              {totals.credit > 0 && (
                <tr className="text-muted-foreground">
                  <td className="px-3 py-1">Crédit</td>
                  <td colSpan={6} />
                  <td className="text-right px-3 py-1 font-mono">
                    -{formatCurrency(totals.credit)}
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
          {TVA_STEPS.map(step => (
            <div key={step.key} className="flex items-center gap-1">
              <span className="font-semibold">{step.shortLabel}.</span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
