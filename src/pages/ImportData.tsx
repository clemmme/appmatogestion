import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardPaste, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  Trash2 
} from 'lucide-react';
import { toast } from 'sonner';
import type { Branch } from '@/types/database.types';
import { Constants } from '@/integrations/supabase/types';

type FormeJuridique = 'SAS' | 'SARL' | 'EURL' | 'SA' | 'SCI' | 'EI' | 'SASU' | 'SNC' | 'AUTRE';
type RegimeFiscal = 'IS' | 'IR' | 'MICRO' | 'REEL_SIMPLIFIE' | 'REEL_NORMAL';
type TvaMode = 'mensuel' | 'trimestriel';

interface ParsedRow {
  nom: string;
  siren: string;
  forme_juridique: FormeJuridique;
  regime_fiscal: RegimeFiscal;
  isValid: boolean;
  errors: string[];
}

interface ManualDossier {
  nom: string;
  siren: string;
  forme_juridique: FormeJuridique;
  regime_fiscal: RegimeFiscal;
  tva_mode: TvaMode;
  cloture: string;
}

const VALID_FORMES: FormeJuridique[] = ['SAS', 'SARL', 'EURL', 'SA', 'SCI', 'EI', 'SASU', 'SNC', 'AUTRE'];
const VALID_REGIMES: RegimeFiscal[] = ['IS', 'IR', 'MICRO', 'REEL_SIMPLIFIE', 'REEL_NORMAL'];
const VALID_TVA_MODES: TvaMode[] = ['mensuel', 'trimestriel'];

const ImportData: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, profile, branch } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [activeTab, setActiveTab] = useState('paste');
  
  // Paste mode state
  const [pasteText, setPasteText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  
  // Manual mode state
  const [manualDossier, setManualDossier] = useState<ManualDossier>({
    nom: '',
    siren: '',
    forme_juridique: 'SARL',
    regime_fiscal: 'IS',
    tva_mode: 'mensuel',
    cloture: '',
  });
  
  const [importing, setImporting] = useState(false);

  // All roles can access import now (Collaborator included with restrictions)
  const isExpert = userRole === 'admin' || userRole === 'manager';
  const isCollaborator = userRole === 'collaborator';

  useEffect(() => {
    if (isCollaborator && branch) {
      // Collaborators can only use their own branch
      setBranches([branch]);
      setSelectedBranch(branch.id);
    } else {
      fetchBranches();
    }
  }, [isCollaborator, branch]);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .order('name');
    if (data) {
      setBranches(data as Branch[]);
      if (data.length > 0) setSelectedBranch(data[0].id);
    }
  };

  const sanitizeText = (text: string): string => {
    // Remove formula injection characters
    return text.replace(/^[=+\-@\t\r]+/, '').trim();
  };

  const normalizeFormeJuridique = (value: string): FormeJuridique => {
    const upper = value.toUpperCase().trim();
    const match = VALID_FORMES.find(f => f === upper);
    return match || 'AUTRE';
  };

  const normalizeRegimeFiscal = (value: string): RegimeFiscal => {
    const upper = value.toUpperCase().trim();
    const match = VALID_REGIMES.find(r => r === upper);
    return match || 'IS';
  };

  const parsePastedData = () => {
    setIsParsing(true);
    try {
      const lines = pasteText.split('\n').filter(line => line.trim());
      const parsed: ParsedRow[] = lines.map(line => {
        // Split by tab (Excel default) or multiple spaces
        const cells = line.split(/\t|  +/).map(c => sanitizeText(c));
        const errors: string[] = [];
        
        const nom = cells[0] || '';
        const siren = cells[1] || '';
        const forme = cells[2] || '';
        const regime = cells[3] || '';

        if (!nom) errors.push('Nom requis');
        if (siren && !/^\d{9}$/.test(siren.replace(/\s/g, ''))) {
          errors.push('SIREN invalide (9 chiffres)');
        }

        return {
          nom,
          siren: siren.replace(/\s/g, ''),
          forme_juridique: normalizeFormeJuridique(forme),
          regime_fiscal: normalizeRegimeFiscal(regime),
          isValid: errors.length === 0 && nom.length > 0,
          errors,
        };
      });

      setParsedData(parsed);
      
      const validCount = parsed.filter(r => r.isValid).length;
      toast.info(`${validCount} lignes valides sur ${parsed.length}`);
    } catch (err) {
      toast.error('Erreur lors du parsing');
    } finally {
      setIsParsing(false);
    }
  };

  const removeRow = (index: number) => {
    setParsedData(prev => prev.filter((_, i) => i !== index));
  };

  const importPastedData = async () => {
    const validRows = parsedData.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('Aucune ligne valide à importer');
      return;
    }
    if (!selectedBranch) {
      toast.error('Sélectionnez un établissement');
      return;
    }

    setImporting(true);
    try {
      const dossiers = validRows.map(row => ({
        nom: row.nom,
        siren: row.siren || null,
        forme_juridique: row.forme_juridique,
        regime_fiscal: row.regime_fiscal,
        branch_id: selectedBranch,
        // Collaborators must be assigned as manager of their dossiers
        manager_id: isCollaborator ? profile?.id : null,
      }));

      const { error } = await supabase.from('dossiers').insert(dossiers);
      if (error) {
        console.error('Insert error:', error);
        throw new Error(error.message || 'Erreur RLS: vérifiez vos permissions');
      }

      toast.success(`${validRows.length} dossiers importés avec succès!`);
      setParsedData([]);
      setPasteText('');
      navigate('/dossiers');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) {
      toast.error('Sélectionnez un établissement');
      return;
    }

    setImporting(true);
    try {
      const insertData: any = {
        nom: manualDossier.nom.trim(),
        siren: manualDossier.siren.replace(/\s/g, '') || null,
        forme_juridique: manualDossier.forme_juridique,
        regime_fiscal: manualDossier.regime_fiscal,
        tva_mode: manualDossier.tva_mode,
        cloture: manualDossier.cloture || null,
        branch_id: selectedBranch,
      };

      // Collaborators must be assigned as manager of their dossiers
      if (isCollaborator && profile) {
        insertData.manager_id = profile.id;
      }

      const { error } = await supabase.from('dossiers').insert(insertData);

      if (error) {
        console.error('Insert error details:', error);
        throw new Error(`Erreur: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
      }

      toast.success('Dossier créé avec succès!');
      setManualDossier({
        nom: '',
        siren: '',
        forme_juridique: 'SARL',
        regime_fiscal: 'IS',
        tva_mode: 'mensuel',
        cloture: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setImporting(false);
    }
  };

  // Handle keyboard navigation in manual form
  const handleKeyDown = (e: React.KeyboardEvent, nextFieldId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextField = document.getElementById(nextFieldId);
      if (nextField) nextField.focus();
    }
  };

  // Remove access restriction - all roles can import now
  // Collaborators are restricted by RLS to only create dossiers assigned to themselves

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import de dossiers</h1>
          <p className="text-muted-foreground">
            Ajoutez vos dossiers clients rapidement
          </p>
        </div>
      </div>

      <div className="card-professional p-4">
        <Label>Établissement de destination</Label>
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-full max-w-xs mt-2">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="paste" className="flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4" />
            Copier-Coller
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Saisie Manuelle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-4 mt-4">
          <div className="card-professional p-6">
            <Label htmlFor="paste-area" className="text-base font-medium">
              Collez vos données Excel ici
            </Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Format attendu: <code className="bg-muted px-1 rounded">Nom  SIREN  Forme  Régime</code> (séparés par tabulation)
            </p>
            <Textarea
              id="paste-area"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Copiez vos lignes Excel (Ctrl+V) directement ici...

Exemple:
SARL DUPONT	123456789	SARL	IS
SCI MARTIN	987654321	SCI	IR"
              className="min-h-[200px] font-mono text-sm"
            />
            <Button 
              onClick={parsePastedData} 
              className="mt-4"
              disabled={!pasteText.trim() || isParsing}
            >
              {isParsing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ClipboardPaste className="w-4 h-4 mr-2" />
              )}
              Analyser les données
            </Button>
          </div>

          {parsedData.length > 0 && (
            <div className="card-professional overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Aperçu avant import</h3>
                  <p className="text-sm text-muted-foreground">
                    {parsedData.filter(r => r.isValid).length} lignes valides sur {parsedData.length}
                  </p>
                </div>
                <Button 
                  onClick={importPastedData}
                  disabled={importing || parsedData.filter(r => r.isValid).length === 0}
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Importer {parsedData.filter(r => r.isValid).length} dossiers
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>SIREN</TableHead>
                    <TableHead>Forme</TableHead>
                    <TableHead>Régime</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, idx) => (
                    <TableRow key={idx} className={!row.isValid ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="w-4 h-4 text-status-done" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive" />
                            <span className="text-xs text-destructive">{row.errors.join(', ')}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.nom || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{row.siren || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.forme_juridique}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.regime_fiscal}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <form onSubmit={handleManualSubmit} className="card-professional p-6 space-y-4 max-w-2xl">
            <h3 className="font-medium text-lg mb-4">Création rapide de dossier</h3>
            
            <div className="space-y-2">
              <Label htmlFor="manual-nom">Nom du dossier *</Label>
              <Input
                id="manual-nom"
                value={manualDossier.nom}
                onChange={(e) => setManualDossier({ ...manualDossier, nom: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'manual-siren')}
                placeholder="SARL DUPONT"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-siren">SIREN (optionnel)</Label>
              <Input
                id="manual-siren"
                value={manualDossier.siren}
                onChange={(e) => setManualDossier({ ...manualDossier, siren: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'manual-forme')}
                placeholder="123 456 789"
                maxLength={11}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-forme">Forme juridique</Label>
                <Select
                  value={manualDossier.forme_juridique}
                  onValueChange={(v) => setManualDossier({ ...manualDossier, forme_juridique: v as FormeJuridique })}
                >
                  <SelectTrigger id="manual-forme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_FORMES.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-regime">Régime fiscal</Label>
                <Select
                  value={manualDossier.regime_fiscal}
                  onValueChange={(v) => setManualDossier({ ...manualDossier, regime_fiscal: v as RegimeFiscal })}
                >
                  <SelectTrigger id="manual-regime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_REGIMES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode TVA</Label>
                <Select
                  value={manualDossier.tva_mode}
                  onValueChange={(v) => setManualDossier({ ...manualDossier, tva_mode: v as TvaMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_TVA_MODES.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-cloture">Date de clôture</Label>
                <Input
                  id="manual-cloture"
                  type="date"
                  value={manualDossier.cloture}
                  onChange={(e) => setManualDossier({ ...manualDossier, cloture: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={importing || !manualDossier.nom.trim()}>
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Créer le dossier
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/dossiers')}
              >
                Voir tous les dossiers
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImportData;
