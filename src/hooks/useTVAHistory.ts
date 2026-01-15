import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TVAHistory, TVAStep } from '@/types/tva.types';
import { toast } from 'sonner';

interface UseTVAHistoryOptions {
  dossierId?: string;
  period?: string;
  year?: number;
}

export function useTVAHistory(options: UseTVAHistoryOptions = {}) {
  const queryClient = useQueryClient();

  // Fetch history for a specific dossier and year
  const historyQuery = useQuery({
    queryKey: ['tva-history', options.dossierId, options.year],
    queryFn: async () => {
      if (!options.dossierId || !options.year) return [];
      
      const startPeriod = `${options.year}-01`;
      const endPeriod = `${options.year}-12`;
      
      const { data, error } = await supabase
        .from('tva_history')
        .select('*')
        .eq('dossier_id', options.dossierId)
        .gte('period', startPeriod)
        .lte('period', endPeriod)
        .order('period');
      
      if (error) throw error;
      return data as TVAHistory[];
    },
    enabled: !!options.dossierId && !!options.year,
  });

  // Fetch history for a specific period across all accessible dossiers
  const periodHistoryQuery = useQuery({
    queryKey: ['tva-history-period', options.period],
    queryFn: async () => {
      if (!options.period) return [];
      
      const { data, error } = await supabase
        .from('tva_history')
        .select(`
          *,
          dossier:dossiers(id, code, nom, tva_mode, tva_deadline_day)
        `)
        .eq('period', options.period);
      
      if (error) throw error;
      return data;
    },
    enabled: !!options.period,
  });

  // Upsert (create or update) a TVA history entry
  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<TVAHistory> & { dossier_id: string; period: string }) => {
      const { data: result, error } = await supabase
        .from('tva_history')
        .upsert({
          ...data,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'dossier_id,period',
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tva-history'] });
      toast.success('TVA mise à jour');
    },
    onError: (error) => {
      console.error('TVA update error:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  // Toggle a specific step
  const toggleStepMutation = useMutation({
    mutationFn: async ({ 
      dossierId, 
      period, 
      step, 
      value 
    }: { 
      dossierId: string; 
      period: string; 
      step: TVAStep; 
      value: boolean;
    }) => {
      // First, try to get existing entry
      const { data: existing } = await supabase
        .from('tva_history')
        .select('*')
        .eq('dossier_id', dossierId)
        .eq('period', period)
        .maybeSingle();

      const updateData: Partial<TVAHistory> = {
        dossier_id: dossierId,
        period,
        [step]: value,
      };

      // If marking as validated (step 6), set completed_at
      if (step === 'step_valide' && value) {
        updateData.completed_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          updateData.completed_by = user.id;
        }
      } else if (step === 'step_valide' && !value) {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { data, error } = await supabase
        .from('tva_history')
        .upsert({
          ...existing,
          ...updateData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'dossier_id,period',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tva-history'] });
    },
    onError: (error) => {
      console.error('Step toggle error:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  // Update montant/credit/note
  const updateDetailsMutation = useMutation({
    mutationFn: async ({
      dossierId,
      period,
      montant,
      credit,
      note,
    }: {
      dossierId: string;
      period: string;
      montant?: number;
      credit?: number;
      note?: string;
    }) => {
      const { data: existing } = await supabase
        .from('tva_history')
        .select('*')
        .eq('dossier_id', dossierId)
        .eq('period', period)
        .maybeSingle();

      const updateData: Record<string, unknown> = {
        dossier_id: dossierId,
        period,
      };
      
      if (montant !== undefined) updateData.montant = montant;
      if (credit !== undefined) updateData.credit = credit;
      if (note !== undefined) updateData.note = note;

      const { data, error } = await supabase
        .from('tva_history')
        .upsert({
          ...existing,
          ...updateData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'dossier_id,period',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tva-history'] });
      toast.success('Détails TVA mis à jour');
    },
    onError: (error) => {
      console.error('Details update error:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  return {
    // Queries
    history: historyQuery.data ?? [],
    periodHistory: periodHistoryQuery.data ?? [],
    isLoading: historyQuery.isLoading || periodHistoryQuery.isLoading,
    error: historyQuery.error || periodHistoryQuery.error,
    
    // Mutations
    upsert: upsertMutation.mutateAsync,
    toggleStep: toggleStepMutation.mutateAsync,
    updateDetails: updateDetailsMutation.mutateAsync,
    isUpdating: upsertMutation.isPending || toggleStepMutation.isPending || updateDetailsMutation.isPending,
  };
}
