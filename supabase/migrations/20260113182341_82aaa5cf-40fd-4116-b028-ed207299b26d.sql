-- Fix: Remove the overly permissive policy that allows anyone to read invitation tokens
DROP POLICY IF EXISTS "Anyone can read valid tokens" ON public.invitation_tokens;

-- Create a secure function to validate invitation tokens
-- This uses SECURITY DEFINER to bypass RLS and only returns data for a specific token
CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_value text)
RETURNS TABLE(
  profile_id uuid,
  full_name text,
  email text,
  organization_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    o.name
  FROM invitation_tokens t
  JOIN profiles p ON t.profile_id = p.id
  JOIN organizations o ON p.organization_id = o.id
  WHERE t.token = token_value
    AND t.expires_at > now()
    AND t.used_at IS NULL
  LIMIT 1;
END;
$$;

-- Grant execute to anon and authenticated so the invitation page works
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;

-- Create a secure function to mark a token as used
CREATE OR REPLACE FUNCTION public.use_invitation_token(token_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
BEGIN
  -- Find and validate the token
  SELECT id INTO v_token_id
  FROM invitation_tokens
  WHERE token = token_value
    AND expires_at > now()
    AND used_at IS NULL
  LIMIT 1;
  
  IF v_token_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Mark as used
  UPDATE invitation_tokens
  SET used_at = now()
  WHERE id = v_token_id;
  
  RETURN true;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.use_invitation_token(text) TO anon, authenticated;