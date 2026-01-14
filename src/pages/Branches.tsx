import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Branch } from '@/types/database.types';
import { branchSchema, validateData } from '@/lib/validation';

export const Branches: React.FC = () => {
  const { organization, userRole } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', city: '' });

  const isExpert = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) throw error;
      setBranches(data as Branch[]);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Erreur lors du chargement des établissements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBranch(null);
    setFormData({ name: '', city: '' });
    setModalOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({ name: branch.name, city: branch.city || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data using Zod schema
    const validation = validateData(branchSchema, {
      name: formData.name,
      city: formData.city || null,
    });

    if (!validation.success) {
      const errorResult = validation as { success: false; error: string };
      toast.error(errorResult.error);
      return;
    }

    const validatedName = validation.data.name;
    const validatedCity = validation.data.city;
    
    if (!organization?.id) {
      toast.error('Erreur : Organisation non trouvée. Veuillez vous reconnecter.');
      return;
    }

    setSaving(true);
    try {

      if (editingBranch) {
        const { data, error } = await supabase
          .from('branches')
          .update({
            name: validatedName,
            city: validatedCity || null,
          })
          .eq('id', editingBranch.id)
          .select()
          .single();

        if (error) {
          if (error.code === '42501') {
            throw new Error('Vous n\'avez pas les droits pour modifier cet établissement. Seuls les Experts peuvent effectuer cette action.');
          }
          throw error;
        }
        setBranches(prev => prev.map(b => b.id === data.id ? data as Branch : b));
        toast.success('Établissement mis à jour avec succès');
      } else {
        const { data, error } = await supabase
          .from('branches')
          .insert({
            name: validatedName,
            city: validatedCity || null,
            organization_id: organization.id,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '42501') {
            throw new Error('Vous n\'avez pas les droits pour créer un établissement. Seuls les Experts peuvent effectuer cette action.');
          }
          if (error.code === '23505') {
            throw new Error('Un établissement avec ce nom existe déjà.');
          }
          throw error;
        }
        setBranches(prev => [...prev, data as Branch]);
        toast.success(`Établissement "${data.name}" créé avec succès`);
      }
      setModalOpen(false);
    } catch (error: any) {
      console.error('Error saving branch:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde de l\'établissement');
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet établissement ? Les dossiers associés seront également affectés.')) return;

    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) {
        if (error.code === '42501') {
          throw new Error('Vous n\'avez pas les droits pour supprimer cet établissement.');
        }
        if (error.code === '23503') {
          throw new Error('Impossible de supprimer : des dossiers sont encore liés à cet établissement.');
        }
        throw error;
      }
      setBranches(prev => prev.filter(b => b.id !== id));
      toast.success('Établissement supprimé avec succès');
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      toast.error(error.message || 'Erreur lors de la suppression de l\'établissement');
    }
  };

  if (!isExpert) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
          <p className="text-muted-foreground">
            Seuls les administrateurs peuvent gérer les établissements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Établissements</h1>
          <p className="text-muted-foreground">
            Gérez les différents sites de {organization?.name || 'votre cabinet'}
          </p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel établissement
        </Button>
      </div>

      <div className="card-professional overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Date de création</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>{branch.city || '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(branch.created_at).toLocaleDateString('fr-FR')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(branch)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(branch.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {branches.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {loading ? 'Chargement...' : 'Aucun établissement'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? 'Modifier l\'établissement' : 'Nouvel établissement'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Siège social"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Marseille"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !formData.name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBranch ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Branches;
