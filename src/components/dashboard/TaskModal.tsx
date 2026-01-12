import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import type { Dossier, TacheFiscale, TacheType, TacheStatut } from '@/types/database.types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  dossier: Dossier;
  month: string;
  task: TacheFiscale | null;
  taskType: TacheType;
  onSave: (task: TacheFiscale) => void;
}

const statusOptions: { value: TacheStatut; label: string }[] = [
  { value: 'a_faire', label: 'À faire' },
  { value: 'fait', label: 'Déclaré' },
  { value: 'retard', label: 'En retard' },
  { value: 'credit', label: 'Crédit TVA' },
  { value: 'neant', label: 'Néant' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  open,
  onClose,
  dossier,
  month,
  task,
  taskType,
  onSave,
}) => {
  const [statut, setStatut] = useState<TacheStatut>(task?.statut || 'a_faire');
  const [montant, setMontant] = useState<string>(
    task?.montant !== null && task?.montant !== undefined ? String(task.montant) : ''
  );
  const [commentaire, setCommentaire] = useState(task?.commentaire || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const dateEcheance = `${month}-15`; // Mid-month as default

      if (task) {
        // Update existing task
        const { data, error } = await supabase
          .from('taches_fiscales')
          .update({
            statut,
            montant: montant ? parseFloat(montant) : null,
            commentaire: commentaire || null,
            completed_at: statut === 'fait' ? new Date().toISOString() : null,
          })
          .eq('id', task.id)
          .select()
          .single();

        if (error) throw error;
        toast.success('Tâche mise à jour');
        onSave(data as TacheFiscale);
      } else {
        // Create new task
        const { data, error } = await supabase
          .from('taches_fiscales')
          .insert({
            dossier_id: dossier.id,
            type: taskType,
            date_echeance: dateEcheance,
            statut,
            montant: montant ? parseFloat(montant) : null,
            commentaire: commentaire || null,
            completed_at: statut === 'fait' ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success('Tâche créée');
        onSave(data as TacheFiscale);
      }
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (month: string) => {
    try {
      const date = parseISO(`${month}-01`);
      return format(date, 'MMMM yyyy', { locale: fr });
    } catch {
      return month;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {taskType} - {formatMonth(month)}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {dossier.nom} ({dossier.forme_juridique})
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="statut">Statut</Label>
            <Select
              value={statut}
              onValueChange={(value) => setStatut(value as TacheStatut)}
            >
              <SelectTrigger>
                <SelectValue>
                  <StatusBadge statut={statut} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <StatusBadge statut={option.value} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="montant">Montant (€)</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Utilisez un nombre négatif pour un crédit TVA
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="commentaire">Commentaire</Label>
            <Textarea
              id="commentaire"
              placeholder="Notes ou observations..."
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
