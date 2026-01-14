import { z } from 'zod';

// ========================================
// Common validation utilities
// ========================================

/**
 * Sanitizes text input by removing potentially dangerous characters
 * and trimming whitespace.
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Prevent CSV formula injection
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validates a SIREN number (9 digits)
 */
export function isValidSiren(siren: string): boolean {
  if (!siren) return true; // Optional field
  const cleaned = siren.replace(/\s/g, '');
  return /^\d{9}$/.test(cleaned);
}

// ========================================
// Dossier validation schemas
// ========================================

export const dossierSchema = z.object({
  code: z.string().max(50, 'Le code ne doit pas dépasser 50 caractères').optional().nullable(),
  nom: z.string()
    .min(1, 'Le nom est obligatoire')
    .max(200, 'Le nom ne doit pas dépasser 200 caractères')
    .transform(s => sanitizeText(s, 200)),
  siren: z.string()
    .max(15, 'Le SIREN ne doit pas dépasser 15 caractères')
    .refine(s => !s || isValidSiren(s), 'Le SIREN doit contenir 9 chiffres')
    .optional()
    .nullable(),
  forme_juridique: z.enum(['SAS', 'SARL', 'EURL', 'SA', 'SCI', 'EI', 'SASU', 'SNC', 'AUTRE']),
  regime_fiscal: z.enum(['IS', 'IR', 'MICRO', 'REEL_SIMPLIFIE', 'REEL_NORMAL']),
  tva_mode: z.enum(['mensuel', 'trimestriel']),
  tva_deadline_day: z.number().int().min(1).max(31),
  cloture: z.string().max(10).optional().nullable(),
  branch_id: z.string().uuid('Établissement invalide'),
});

export type DossierFormData = z.infer<typeof dossierSchema>;

// ========================================
// Branch validation schemas
// ========================================

export const branchSchema = z.object({
  name: z.string()
    .min(1, 'Le nom est obligatoire')
    .max(100, 'Le nom ne doit pas dépasser 100 caractères')
    .transform(s => sanitizeText(s, 100)),
  city: z.string()
    .max(100, 'La ville ne doit pas dépasser 100 caractères')
    .transform(s => sanitizeText(s, 100))
    .optional()
    .nullable(),
});

export type BranchFormData = z.infer<typeof branchSchema>;

// ========================================
// Task validation schemas
// ========================================

export const taskSchema = z.object({
  statut: z.enum(['a_faire', 'fait', 'retard', 'credit', 'neant']),
  montant: z.number().nullable().optional(),
  commentaire: z.string()
    .max(2000, 'Le commentaire ne doit pas dépasser 2000 caractères')
    .transform(s => sanitizeText(s, 2000))
    .optional()
    .nullable(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

// ========================================
// AI Chat validation schemas
// ========================================

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
    .min(1, 'Le message ne peut pas être vide')
    .max(4000, 'Le message ne doit pas dépasser 4000 caractères'),
});

export const chatMessagesSchema = z.array(chatMessageSchema)
  .max(50, 'Trop de messages dans la conversation');

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// ========================================
// Import validation schemas
// ========================================

export const importRowSchema = z.object({
  nom: z.string()
    .min(1, 'Le nom est obligatoire')
    .max(200, 'Le nom ne doit pas dépasser 200 caractères')
    .transform(s => sanitizeText(s, 200)),
  siren: z.string()
    .max(15)
    .refine(s => !s || isValidSiren(s), 'SIREN invalide')
    .optional()
    .nullable(),
  forme_juridique: z.string().max(20).optional().nullable(),
  regime_fiscal: z.string().max(20).optional().nullable(),
  tva_mode: z.string().max(20).optional().nullable(),
  cloture: z.string().max(10).optional().nullable(),
});

export type ImportRowData = z.infer<typeof importRowSchema>;

// ========================================
// Profile validation schemas
// ========================================

export const profileUpdateSchema = z.object({
  full_name: z.string()
    .min(1, 'Le nom complet est obligatoire')
    .max(150, 'Le nom ne doit pas dépasser 150 caractères')
    .transform(s => sanitizeText(s, 150)),
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

// Validation result types
export type ValidationSuccess<T> = { success: true; data: T };
export type ValidationError = { success: false; error: string };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      const firstError = e.errors[0];
      return { 
        success: false, 
        error: firstError?.message || 'Données invalides' 
      };
    }
    return { success: false, error: 'Erreur de validation' };
  }
}
