import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { Dossier, Branch, FormeJuridique, RegimeFiscal, TvaMode } from '@/types/database.types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { dossierSchema, validateData } from '@/lib/validation';
import { useAuth } from '@/contexts/AuthContext';

interface DossierModalProps {
  open: boolean;
  onClose: () => void;
  dossier: Dossier | null;
  branches: Branch[];
  onSave: (dossier: Dossier) => void;
}

const formeOptions: FormeJuridique[] = ['SAS', 'SARL', 'EURL', 'SA', 'SCI', 'EI', 'SASU', 'SNC', 'AUTRE'];
const regimeOptions: RegimeFiscal[] = ['IS', 'IR', 'MICRO', 'REEL_SIMPLIFIE', 'REEL_NORMAL'];

export const DossierModal: React.FC<DossierModalProps> = ({
  open,
  onClose,
  dossier,
  branches,
  onSave,
}) => {
  const { userRole, profile, branch } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const isCollaborator = userRole === 'collaborator';
  
  // For collaborators, filter branches to only show their own
  const availableBranches = isCollaborator && branch 
    ? branches.filter(b => b.id === branch.id) 
    : branches;

  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    siren: '',
    forme_juridique: 'SARL' as FormeJuridique,
    regime_fiscal: 'IS' as RegimeFiscal,
    tva_mode: 'mensuel' as TvaMode,
    tva_deadline_day: 21,
    cloture: '',
    branch_id: '',
  });

  useEffect(() => {
    if (dossier) {
      setFormData({
        code: dossier.code || '',
        nom: dossier.nom,
        siren: dossier.siren || '',
        forme_juridique: dossier.forme_juridique,
        regime_fiscal: dossier.regime_fiscal,
        tva_mode: dossier.tva_mode,
        tva_deadline_day: (dossier as any).tva_deadline_day || 21,
        cloture: dossier.cloture || '',
        branch_id: dossier.branch_id,
      });
    } else {
      // For new dossiers, set default branch
      // Collaborators get their own branch pre-selected
      const defaultBranch = isCollaborator && branch 
        ? branch.id 
        : availableBranches[0]?.id || '';
        
      setFormData({
        code: '',
        nom: '',
        siren: '',
        forme_juridique: 'SARL',
        regime_fiscal: 'IS',
        tva_mode: 'mensuel',
        tva_deadline_day: 21,
        cloture: '',
        branch_id: defaultBranch,
      });
    }
  }, [dossier, availableBranches, isCollaborator, branch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data using Zod schema
    const validation = validateData(dossierSchema, {
      code: formData.code || null,
      nom: formData.nom,
      siren: formData.siren || null,
      forme_juridique: formData.forme_juridique,
      regime_fiscal: formData.regime_fiscal,
      tva_mode: formData.tva_mode,
      tva_deadline_day: formData.tva_deadline_day,
      cloture: formData.cloture || null,
      branch_id: formData.branch_id,
    });

    if (!validation.success) {
      const errorResult = validation as { success: false; error: string };
      toast.error(errorResult.error);
      return;
    }

    const validatedData = validation.data;
    setLoading(true);

    try {
      const data: any = {
        code: validatedData.code || null,
        nom: validatedData.nom,
        siren: validatedData.siren || null,
        forme_juridique: validatedData.forme_juridique,
        regime_fiscal: validatedData.regime_fiscal,
        tva_mode: validatedData.tva_mode,
        tva_deadline_day: validatedData.tva_deadline_day,
        cloture: validatedData.cloture || null,
        branch_id: validatedData.branch_id,
      };

      // For collaborators creating new dossiers, set manager_id to their profile
      if (!dossier && isCollaborator && profile) {
        data.manager_id = profile.id;
      }

      if (dossier) {
        const { data: updated, error } = await supabase
          .from('dossiers')
          .update(data)
          .eq('id', dossier.id)
          .select()
          .single();

        if (error) {
          console.error('Update error:', error);
          throw new Error(`Erreur: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
        }
        toast.success('Dossier mis à jour');
        onSave(updated as Dossier);
      } else {
        const { data: created, error } = await supabase
          .from('dossiers')
          .insert(data)
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw new Error(`Erreur: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
        }
        toast.success('Dossier créé');
        onSave(created as Dossier);
      }
    } catch (error: any) {
      console.error('Error saving dossier:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {dossier ? 'Modifier le dossier' : 'Nouveau dossier'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="ABC123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siren">SIREN</Label>
              <Input
                id="siren"
                value={formData.siren}
                onChange={(e) => setFormData({ ...formData, siren: e.target.value })}
                placeholder="123456789"
                maxLength={9}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              placeholder="Nom du dossier"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forme juridique</Label>
              <Select
                value={formData.forme_juridique}
                onValueChange={(v) => setFormData({ ...formData, forme_juridique: v as FormeJuridique })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formeOptions.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Régime fiscal</Label>
              <Select
                value={formData.regime_fiscal}
                onValueChange={(v) => setFormData({ ...formData, regime_fiscal: v as RegimeFiscal })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regimeOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mode TVA</Label>
              <Select
                value={formData.tva_mode}
                onValueChange={(v) => setFormData({ ...formData, tva_mode: v as TvaMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="trimestriel">Trimestriel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jour limite TVA</Label>
              <Select
                value={String(formData.tva_deadline_day)}
                onValueChange={(v) => setFormData({ ...formData, tva_deadline_day: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      Le {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloture">Clôture</Label>
              <Input
                id="cloture"
                type="date"
                value={formData.cloture}
                onChange={(e) => setFormData({ ...formData, cloture: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Établissement *</Label>
            <Select
              value={formData.branch_id}
              onValueChange={(v) => setFormData({ ...formData, branch_id: v })}
              disabled={isCollaborator} // Collaborators can't change branch
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} {b.city && `(${b.city})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCollaborator && (
              <p className="text-xs text-muted-foreground">
                Les collaborateurs ne peuvent créer des dossiers que dans leur établissement.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !formData.nom || !formData.branch_id}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dossier ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
