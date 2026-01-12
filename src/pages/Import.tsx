import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnMapping {
  csvColumn: string;
  dbField: string | null;
}

const dbFields = [
  { value: 'code', label: 'Code dossier' },
  { value: 'nom', label: 'Nom' },
  { value: 'siren', label: 'SIREN' },
  { value: 'forme_juridique', label: 'Forme juridique' },
  { value: 'regime_fiscal', label: 'Régime fiscal' },
  { value: 'tva_mode', label: 'Mode TVA' },
  { value: 'cloture', label: 'Date clôture' },
  { value: 'tva_data', label: 'Données TVA (colonne mensuelle)' },
  { value: 'ignore', label: '— Ignorer —' },
];

export const Import: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');

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
    const lower = column.toLowerCase();
    if (lower.includes('code')) return 'code';
    if (lower.includes('nom') || lower.includes('name')) return 'nom';
    if (lower.includes('siren')) return 'siren';
    if (lower.includes('forme')) return 'forme_juridique';
    if (lower.includes('regime') || lower.includes('régime')) return 'regime_fiscal';
    if (lower.includes('tva') && lower.includes('mode')) return 'tva_mode';
    if (lower.includes('cloture') || lower.includes('clôture')) return 'cloture';
    if (/\d{4}-\d{2}/.test(column) || /janv|fév|mars|avr|mai|juin|juil|août|sept|oct|nov|déc/i.test(column)) {
      return 'tva_data';
    }
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

  const handleImport = () => {
    // Here would be the actual import logic
    setStep('complete');
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Import de données</h1>
        <p className="text-muted-foreground">
          Importez vos tableaux Excel pour migrer vos données
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {['Upload', 'Mapping', 'Aperçu', 'Terminé'].map((label, i) => {
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
                    'text-sm',
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
              Glissez-déposez votre fichier CSV ou Excel
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
              <Button onClick={() => setStep('preview')}>
                Continuer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu de l'import</CardTitle>
            <CardDescription>
              Vérifiez les données avant de lancer l'import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
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
                  {csvData.slice(0, 10).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {mappings
                        .filter((m) => m.dbField && m.dbField !== 'ignore')
                        .map((m, colIndex) => {
                          const originalIndex = mappings.findIndex(
                            (om) => om.csvColumn === m.csvColumn
                          );
                          return (
                            <td key={colIndex} className="px-4 py-2">
                              {row[originalIndex] || '—'}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-status-pending" />
              <div>
                <p className="font-medium text-sm">
                  {csvData.length} lignes seront importées
                </p>
                <p className="text-xs text-muted-foreground">
                  Les colonnes de dates seront transformées en tâches fiscales
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Retour
              </Button>
              <Button onClick={handleImport}>
                Lancer l'import
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
            <h2 className="text-xl font-semibold mb-2">Import réussi !</h2>
            <p className="text-muted-foreground mb-6">
              Les données ont été importées avec succès dans la base de données.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Nouvel import
              </Button>
              <Button onClick={() => window.location.href = '/dashboard'}>
                Voir le tableau de bord
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Import;
