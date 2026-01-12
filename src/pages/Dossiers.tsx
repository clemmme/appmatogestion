import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Dossier, Branch } from '@/types/database.types';
import { DossierModal } from '@/components/dossiers/DossierModal';

export const Dossiers: React.FC = () => {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dossiersRes, branchesRes] = await Promise.all([
        supabase.from('dossiers').select('*').order('nom'),
        supabase.from('branches').select('*').order('name'),
      ]);

      if (dossiersRes.data) setDossiers(dossiersRes.data as Dossier[]);
      if (branchesRes.data) setBranches(branchesRes.data as Branch[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDossiers = dossiers.filter(
    (d) =>
      d.nom.toLowerCase().includes(search.toLowerCase()) ||
      d.siren?.includes(search) ||
      d.code?.toLowerCase().includes(search.toLowerCase())
  );

  const getBranchName = (branchId: string) => {
    return branches.find((b) => b.id === branchId)?.name || '—';
  };

  const handleEdit = (dossier: Dossier) => {
    setEditingDossier(dossier);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingDossier(null);
    setModalOpen(true);
  };

  const handleSave = (dossier: Dossier) => {
    if (editingDossier) {
      setDossiers((prev) =>
        prev.map((d) => (d.id === dossier.id ? dossier : d))
      );
    } else {
      setDossiers((prev) => [...prev, dossier]);
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce dossier ?')) return;

    try {
      await supabase.from('dossiers').delete().eq('id', id);
      setDossiers((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error('Error deleting dossier:', error);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dossiers</h1>
          <p className="text-muted-foreground">
            Gérez les dossiers clients de votre cabinet
          </p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau dossier
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un dossier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">{filteredDossiers.length} dossiers</Badge>
      </div>

      <div className="card-professional overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Forme</TableHead>
              <TableHead>SIREN</TableHead>
              <TableHead>Régime</TableHead>
              <TableHead>TVA</TableHead>
              <TableHead>Établissement</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDossiers.map((dossier) => (
              <TableRow key={dossier.id}>
                <TableCell className="font-mono text-sm">
                  {dossier.code || '—'}
                </TableCell>
                <TableCell className="font-medium">{dossier.nom}</TableCell>
                <TableCell>
                  <Badge variant="outline">{dossier.forme_juridique}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {dossier.siren || '—'}
                </TableCell>
                <TableCell>{dossier.regime_fiscal}</TableCell>
                <TableCell>
                  <Badge
                    variant={dossier.tva_mode === 'mensuel' ? 'default' : 'secondary'}
                  >
                    {dossier.tva_mode === 'mensuel' ? 'Mensuel' : 'Trimestriel'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getBranchName(dossier.branch_id)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(dossier)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(dossier.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredDossiers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {loading ? 'Chargement...' : 'Aucun dossier trouvé'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DossierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dossier={editingDossier}
        branches={branches}
        onSave={handleSave}
      />
    </div>
  );
};

export default Dossiers;
