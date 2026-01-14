import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es un assistant fiscal expert pour les experts-comptables français. Tu aides les utilisateurs avec :
- Les questions sur la TVA (déclarations mensuelles, trimestrielles, régimes)
- L'impôt sur les sociétés (IS) et ses acomptes
- Les liasses fiscales
- La CVAE et la CFE
- Les régimes fiscaux (IS, IR, micro, réel simplifié, réel normal)
- Les formes juridiques (SAS, SARL, EURL, SA, SCI, EI, SASU, SNC)

Réponds de manière claire, concise et professionnelle. Si tu n'es pas sûr d'une information, indique-le clairement.
Utilise des exemples concrets quand c'est pertinent. Formate tes réponses avec des listes à puces quand approprié.`;

// Input validation constants
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const VALID_ROLES = ['user', 'assistant'];

// Message validation schema
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown): { valid: true; messages: ChatMessage[] } | { valid: false; error: string } {
  if (!messages || !Array.isArray(messages)) {
    return { valid: false, error: "Messages array is required" };
  }

  if (messages.length === 0) {
    return { valid: false, error: "Messages array cannot be empty" };
  }

  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Too many messages. Maximum allowed: ${MAX_MESSAGES}` };
  }

  const validatedMessages: ChatMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: `Message at index ${i} is invalid` };
    }

    const { role, content } = msg as Record<string, unknown>;

    // Validate role
    if (!role || typeof role !== 'string' || !VALID_ROLES.includes(role)) {
      return { valid: false, error: `Invalid role at message ${i}. Must be 'user' or 'assistant'` };
    }

    // Validate content
    if (content === undefined || content === null || typeof content !== 'string') {
      return { valid: false, error: `Invalid content at message ${i}. Must be a string` };
    }

    if (content.length === 0) {
      return { valid: false, error: `Message at index ${i} cannot have empty content` };
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message at index ${i} exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
    }

    // Sanitize content - remove control characters
    const sanitizedContent = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    validatedMessages.push({
      role: role as 'user' | 'assistant',
      content: sanitizedContent,
    });
  }

  return { valid: true, messages: validatedMessages };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth validation failed:", userError);
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log("Authenticated user:", userId);

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages: rawMessages } = requestBody as Record<string, unknown>;
    
    // Validate messages with strict schema
    const validation = validateMessages(rawMessages);
    if (!validation.valid) {
      console.error("Message validation failed:", validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = validation.messages;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    console.log("Calling Lovable AI Gateway with", messages.length, "validated messages for user", userId);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        max_tokens: 2048, // Limit response tokens for cost control
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés, veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Fiscal assistant error:", error);
    return new Response(JSON.stringify({ 
      error: "Une erreur est survenue lors du traitement de votre demande" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});