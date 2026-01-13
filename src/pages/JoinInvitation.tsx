import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

interface InvitationData {
  profile_id: string;
  full_name: string;
  email: string;
  organization_name: string;
}

const JoinInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
      return;
    }
    
    if (!token) {
      setError('Lien d\'invitation invalide');
      setLoading(false);
      return;
    }

    validateToken();
  }, [token, user]);

  const validateToken = async () => {
    try {
      // Query invitation token with profile and organization info
      const { data, error: tokenError } = await supabase
        .from('invitation_tokens')
        .select(`
          profile_id,
          profiles!inner(
            id,
            full_name,
            email,
            organization_id,
            organizations!inner(name)
          )
        `)
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .is('used_at', null)
        .single();

      if (tokenError || !data) {
        setError('Ce lien d\'invitation a expiré ou est invalide');
        return;
      }

      const profile = data.profiles as any;
      setInvitation({
        profile_id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        organization_name: profile.organizations?.name || 'le cabinet',
      });
    } catch (err) {
      console.error('Token validation error:', err);
      setError('Erreur lors de la validation de l\'invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setSubmitting(true);
    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation!.email,
        password,
        options: {
          data: { full_name: invitation!.full_name },
        },
      });

      if (signUpError) throw signUpError;

      // Mark token as used
      await supabase
        .from('invitation_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      toast.success('Compte créé avec succès! Bienvenue.');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Sign up error:', err);
      toast.error(err.message || 'Erreur lors de la création du compte');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation invalide</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/auth')}>
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Bienvenue {invitation?.full_name}!</CardTitle>
          <CardDescription>
            Vous avez été invité à rejoindre <strong>{invitation?.organization_name}</strong>.
            Créez votre mot de passe pour accéder à l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={invitation?.email || ''} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez votre mot de passe"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Créer mon compte
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinInvitation;
