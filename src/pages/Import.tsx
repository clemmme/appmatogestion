import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  Download,
  XCircle,
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Branch, FormeJuridique, RegimeFiscal } from '@/types/database.types';

interface ColumnMapping {
  csvColumn: string;
  dbField: string | null;
}

interface ValidationError {
  line: number;
  column: string;
  message: string;
}

interface ValidatedRow {
  isValid: boolean;
  data: Record<string, string>;
  errors: ValidationError[];
}

const dbFields = [
  { value: 'nom', label: 'Nom Dossier *' },
  { value: 'siren', label: 'SIREN' },
  { value: 'forme_juridique', label: 'Forme Juridique' },
  { value: 'regime_fiscal', label: 'Régime Fiscal (IS/IR)' },
  { value: 'cloture', label: 'Date Clôture (AAAA-MM-JJ)' },
  { value: 'code', label: 'Code dossier' },
  { value: 'ignore', label: '— Ignorer —' },
];

const TEMPLATE_HEADERS = ['Nom Dossier', 'Siren', 'Forme Juridique', 'Régime Fiscal', 'Date Clôture'];
const VALID_FORMES: FormeJuridique[] = ['SAS', 'SARL', 'EURL', 'SA', 'SCI', 'EI', 'SASU', 'SNC', 'AUTRE'];
const VALID_REGIMES: RegimeFiscal[] = ['IS', 'IR', 'MICRO', 'REEL_SIMPLIFIE', 'REEL_NORMAL'];

export const Import: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, organization } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState({ success: 0, errors: 0 });

  const isExpert = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data) {
      setBranches(data as Branch[]);
      if (data.length > 0) setSelectedBranch(data[0].id);
    }
  };

  const downloadTemplate = () => {
    const csvContent = TEMPLATE_HEADERS.join(';') + '\n' +
      '2R ORANGE;123456789;SAS;IS;2025-12-31\n' +
      'AD2P;987654321;SARL;IR;2025-06-30\n' +
      'EXEMPLE SOCIETE;456789123;EURL;MICRO;2025-12-31';
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_dossiers.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Modèle CSV téléchargé ! Ouvrez-le avec Excel et remplissez vos données.');
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map((line) =>
        line.split(/[,;]/).map((cell) => cell.trim().replace(/^"|"$/g, ''))
      );

      if (lines.length > 0) {
        setHeaders(lines[0]);
        setCsvData(lines.slice(1).filter((row) => row.some((cell) => cell)));
        setMappings(
          lines[0].map((col) => ({
            csvColumn: col,
            dbField: guessMapping(col),
          }))
        );
        setStep('mapping');
      }
    };
    reader.readAsText(file);
  }, []);

  const guessMapping = (column: string): string | null => {
    const lower = column.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes('code')) return 'code';
    if (lower.includes('nom') || lower.includes('name') || lower.includes('dossier')) return 'nom';
    if (lower.includes('siren')) return 'siren';
    if (lower.includes('forme') || lower.includes('juridique')) return 'forme_juridique';
    if (lower.includes('regime') || lower.includes('fiscal')) return 'regime_fiscal';
    if (lower.includes('cloture') || lower.includes('date')) return 'cloture';
    return null;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const updateMapping = (index: number, dbField: string | null) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, dbField } : m))
    );
  };

  const validateData = () => {
    const validated: ValidatedRow[] = csvData.map((row, rowIndex) => {
      const errors: ValidationError[] = [];
      const data: Record<string, string> = {};

      mappings.forEach((mapping, colIndex) => {
        if (!mapping.dbField || mapping.dbField === 'ignore') return;
        
        const value = row[colIndex] || '';
        data[mapping.dbField] = value;

        // Validation rules
        if (mapping.dbField === 'nom') {
          if (!value.trim()) {
            errors.push({
              line: rowIndex + 2,
              column: mapping.csvColumn,
              message: 'Le nom du dossier est obligatoire',
            });
          }
        }

        if (mapping.dbField === 'siren' && value) {
          const sirenClean = value.replace(/\s/g, '');
          if (!/^\d{9}$/.test(sirenClean)) {
            errors.push({
              line: rowIndex + 2,
              column: mapping.csvColumn,
              message: `SIREN invalide "${value}" — 9 chiffres requis`,
            });
          } else {
            data.siren = sirenClean;
          }
        }

        if (mapping.dbField === 'forme_juridique' && value) {
          const normalized = value.toUpperCase().trim();
          if (!VALID_FORMES.includes(normalized as FormeJuridique)) {
            errors.push({
              line: rowIndex + 2,
              column: mapping.csvColumn,
              message: `Forme juridique invalide "${value}". Acceptées: ${VALID_FORMES.join(', ')}`,
            });
          } else {
            data.forme_juridique = normalized;
          }
        }

        if (mapping.dbField === 'regime_fiscal' && value) {
          const normalized = value.toUpperCase().replace(/\s+/g, '_').trim();
          if (!VALID_REGIMES.includes(normalized as RegimeFiscal)) {
            errors.push({
              line: rowIndex + 2,
              column: mapping.csvColumn,
              message: `Régime fiscal invalide "${value}". Acceptés: ${VALID_REGIMES.join(', ')}`,
            });
          } else {
            data.regime_fiscal = normalized;
          }
        }

        if (mapping.dbField === 'cloture' && value) {
          // Accept formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
          let dateValue = value.trim();
          let isValid = false;
          
          // Try YYYY-MM-DD format
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            const d = new Date(dateValue);
            isValid = !isNaN(d.getTime());
          }
          // Try DD/MM/YYYY or DD-MM-YYYY format
          else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateValue)) {
            const parts = dateValue.split(/[\/\-]/);
            dateValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
            const d = new Date(dateValue);
            isValid = !isNaN(d.getTime());
          }
          
          if (!isValid) {
            errors.push({
              line: rowIndex + 2,
              column: mapping.csvColumn,
              message: `Date invalide "${value}". Format attendu: AAAA-MM-JJ ou JJ/MM/AAAA`,
            });
          } else {
            data.cloture = dateValue;
          }
        }
      });

      return { isValid: errors.length === 0, data, errors };
    });

    setValidatedRows(validated);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!selectedBranch) {
      toast.error('Veuillez sélectionner un établissement');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validatedRows) {
      if (!row.isValid || !row.data.nom) {
        errorCount++;
        continue;
      }

      try {
        const { error } = await supabase.from('dossiers').insert({
          nom: row.data.nom.trim(),
          code: row.data.code?.trim() || null,
          siren: row.data.siren || null,
          forme_juridique: (row.data.forme_juridique as FormeJuridique) || 'AUTRE',
          regime_fiscal: (row.data.regime_fiscal as RegimeFiscal) || 'IS',
          cloture: row.data.cloture || null,
          tva_mode: 'mensuel',
          branch_id: selectedBranch,
          is_active: true,
        });

        if (error) {
          console.error('Insert error:', error);
          if (error.code === '42501') {
            toast.error('Erreur : Vous n\'avez pas les droits pour importer des dossiers.');
            break;
          }
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error('Import error:', err);
        errorCount++;
      }
    }

    setImportStats({ success: successCount, errors: errorCount });
    setImporting(false);
    setStep('complete');
    
    if (successCount > 0) {
      toast.success(`${successCount} dossier(s) importé(s) avec succès`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} ligne(s) ignorée(s)`);
    }
  };

  const allErrors = validatedRows.flatMap(r => r.errors);
  const validCount = validatedRows.filter(r => r.isValid).length;

  if (!isExpert) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
          <p className="text-muted-foreground">
            Seuls les administrateurs peuvent importer des données.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Import de données</h1>
          <p className="text-muted-foreground">
            Importez vos tableaux Excel pour migrer vos données
          </p>
        </div>

        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" />
          Télécharger le modèle
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {['Upload', 'Mapping', 'Validation', 'Terminé'].map((label, i) => {
          const stepIndex = ['upload', 'mapping', 'preview', 'complete'].indexOf(step);
          const isActive = i === stepIndex;
          const isCompleted = i < stepIndex;

          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    isCompleted && 'bg-status-done text-status-done-foreground',
                    isActive && 'bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-sm hidden sm:inline',
                    isActive ? 'font-medium' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {i < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Importer un fichier</CardTitle>
            <CardDescription>
              Glissez-déposez votre fichier CSV ou Excel. <strong>Important:</strong> Téléchargez d'abord le modèle 
              pour connaître le format exact attendu (colonnes, format des dates, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {isDragActive
                  ? 'Déposez le fichier ici...'
                  : 'Glissez votre fichier ici'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou cliquez pour sélectionner
              </p>
              <div className="flex justify-center gap-2">
                <Badge variant="secondary">.csv</Badge>
                <Badge variant="secondary">.xlsx</Badge>
                <Badge variant="secondary">.xls</Badge>
              </div>
            </div>

            <Alert className="mt-4 border-primary/30 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Colonnes attendues :</strong> {TEMPLATE_HEADERS.join(', ')}<br />
                <span className="text-sm text-muted-foreground">
                  Format de date : AAAA-MM-JJ (ex: 2025-12-31) ou JJ/MM/AAAA (ex: 31/12/2025)
                </span>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step: Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Mapping des colonnes
            </CardTitle>
            <CardDescription>
              Associez chaque colonne du CSV à un champ de la base de données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label className="text-sm font-medium">Établissement de destination *</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Sélectionner un établissement" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.city && `(${b.city})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {mappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{mapping.csvColumn}</p>
                    <p className="text-xs text-muted-foreground">
                      Ex: {csvData[0]?.[index] || '—'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="w-[200px]">
                    <Select
                      value={mapping.dbField || 'ignore'}
                      onValueChange={(v) =>
                        updateMapping(index, v === 'ignore' ? null : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dbFields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Retour
              </Button>
              <Button onClick={validateData} disabled={!selectedBranch}>
                Valider les données
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview & Validation */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Rapport de validation</CardTitle>
            <CardDescription>
              Vérifiez les données avant de lancer l'import
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Summary */}
            {allErrors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{allErrors.length} erreur(s) détectée(s)</strong>
                  <ul className="mt-2 list-disc pl-4 text-sm max-h-32 overflow-y-auto">
                    {allErrors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        Ligne {err.line} ({err.column}): {err.message}
                      </li>
                    ))}
                    {allErrors.length > 10 && (
                      <li>... et {allErrors.length - 10} autres erreurs</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Data Preview */}
            <div className="rounded-lg border overflow-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium w-12">État</th>
                    {mappings
                      .filter((m) => m.dbField && m.dbField !== 'ignore')
                      .map((m, i) => (
                        <th key={i} className="px-4 py-2 text-left font-medium">
                          {m.csvColumn}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {validatedRows.slice(0, 20).map((row, rowIndex) => (
                    <tr key={rowIndex} className={cn('border-t', !row.isValid && 'bg-destructive/5')}>
                      <td className="px-4 py-2">
                        {row.isValid ? (
                          <Check className="w-4 h-4 text-status-done" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </td>
                      {mappings
                        .filter((m) => m.dbField && m.dbField !== 'ignore')
                        .map((m, colIndex) => {
                          const originalIndex = mappings.findIndex(
                            (om) => om.csvColumn === m.csvColumn
                          );
                          return (
                            <td key={colIndex} className="px-4 py-2">
                              {csvData[rowIndex]?.[originalIndex] || '—'}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-status-pending" />
                <div>
                  <p className="font-medium text-sm">
                    {validCount} / {validatedRows.length} lignes valides
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Les lignes avec erreurs seront ignorées
                  </p>
                </div>
              </div>
              <Badge variant={validCount > 0 ? 'default' : 'destructive'}>
                {validCount > 0 ? 'Prêt à importer' : 'Aucune donnée valide'}
              </Badge>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Retour
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importer {validCount} dossier(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-status-done/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-status-done" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Import terminé !</h2>
            <p className="text-muted-foreground mb-2">
              {importStats.success} dossier(s) importé(s) avec succès
            </p>
            {importStats.errors > 0 && (
              <p className="text-sm text-destructive mb-4">
                {importStats.errors} ligne(s) ignorée(s) en raison d'erreurs
              </p>
            )}
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setFile(null);
                setCsvData([]);
                setValidatedRows([]);
              }}>
                Nouvel import
              </Button>
              <Button onClick={() => navigate('/dossiers')}>
                Voir les dossiers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Import;
