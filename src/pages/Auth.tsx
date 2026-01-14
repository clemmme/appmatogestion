import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, Building2, Users, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

const createCabinetSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

const joinTeamSchema = z.object({
  joinCode: z.string().min(4, 'Code cabinet invalide'),
  branchId: z.string().uuid('Veuillez sélectionner un établissement'),
  fullName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

interface OrgLookup {
  organization_id: string;
  organization_name: string;
}

interface BranchLookup {
  branch_id: string;
  branch_name: string;
  branch_city: string | null;
}

export const Auth: React.FC = () => {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states - Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Form states - Signup mode
  const [signupMode, setSignupMode] = useState<'create' | 'join'>('create');

  // Form states - Create Cabinet
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');

  // Form states - Join Team
  const [joinCode, setJoinCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [foundOrg, setFoundOrg] = useState<OrgLookup | null>(null);
  const [branches, setBranches] = useState<BranchLookup[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [joinFullName, setJoinFullName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Verify join code
  const handleVerifyCode = async () => {
    if (joinCode.length < 4) {
      setError('Le code cabinet doit contenir au moins 4 caractères');
      return;
    }

    setVerifyingCode(true);
    setError(null);
    setFoundOrg(null);
    setBranches([]);

    try {
      const { data: orgData, error: orgError } = await supabase
        .rpc('lookup_organization_by_code', { code: joinCode });

      if (orgError) throw orgError;

      if (!orgData || orgData.length === 0) {
        setError('Code cabinet invalide ou organisation inactive');
        return;
      }

      const org = orgData[0] as OrgLookup;
      setFoundOrg(org);

      // Fetch branches
      const { data: branchData, error: branchError } = await supabase
        .rpc('get_organization_branches', { org_id: org.organization_id });

      if (branchError) throw branchError;

      setBranches((branchData || []) as BranchLookup[]);
      
      if (!branchData || branchData.length === 0) {
        setError('Aucun établissement trouvé. Contactez l\'administrateur du cabinet.');
      }
    } catch (err: any) {
      console.error('Error verifying code:', err);
      setError(err.message || 'Erreur lors de la vérification du code');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        if (error.message.includes('Invalid login')) {
          setError('Email ou mot de passe incorrect');
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      createCabinetSchema.parse({
        email: createEmail,
        password: createPassword,
        confirmPassword: createConfirmPassword,
        fullName: createFullName,
      });

      const { error } = await signUp(createEmail, createPassword, createFullName);
      if (error) {
        if (error.message.includes('already registered')) {
          setError('Cet email est déjà utilisé');
        } else {
          setError(error.message);
        }
      } else {
        setSuccess('Cabinet créé avec succès ! Vous pouvez maintenant vous connecter.');
        setCreateEmail('');
        setCreatePassword('');
        setCreateConfirmPassword('');
        setCreateFullName('');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      joinTeamSchema.parse({
        joinCode,
        branchId: selectedBranch,
        fullName: joinFullName,
        email: joinEmail,
        password: joinPassword,
        confirmPassword: joinConfirmPassword,
      });

      // Pre-register the user with join code
      const { error: registerError } = await supabase.rpc('register_with_join_code', {
        p_join_code: joinCode,
        p_branch_id: selectedBranch,
        p_full_name: joinFullName,
        p_email: joinEmail,
      });

      if (registerError) {
        if (registerError.message.includes('duplicate')) {
          setError('Cet email est déjà utilisé');
        } else {
          throw registerError;
        }
        return;
      }

      // Now sign up with Supabase Auth
      const redirectUrl = `${window.location.origin}/`;
      const { error: signUpError } = await supabase.auth.signUp({
        email: joinEmail.trim(),
        password: joinPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: joinFullName },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Cet email est déjà utilisé');
        } else {
          throw signUpError;
        }
        return;
      }

      setSuccess(`Inscription réussie dans ${foundOrg?.organization_name}! Vous pouvez maintenant vous connecter.`);
      // Reset form
      setJoinCode('');
      setFoundOrg(null);
      setBranches([]);
      setSelectedBranch('');
      setJoinFullName('');
      setJoinEmail('');
      setJoinPassword('');
      setJoinConfirmPassword('');
    } catch (err: any) {
      console.error('Join team error:', err);
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
            <span className="text-2xl font-bold text-primary-foreground">A</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">APPMATO GESTION</h1>
          <p className="text-muted-foreground mt-1">Gestion fiscale pour cabinets comptables</p>
        </div>

        <Card className="login-card">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 border-status-done bg-status-done/10">
                <CheckCircle className="h-4 w-4 text-status-done" />
                <AlertDescription className="text-status-done">{success}</AlertDescription>
              </Alert>
            )}

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Link 
                      to="/forgot-password" 
                      className="text-sm text-primary hover:underline"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <PasswordInput
                    id="login-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Se connecter
                </Button>
              </form>
            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup">
              {/* Mode selector */}
              <div className="flex gap-2 mb-6">
                <Button
                  type="button"
                  variant={signupMode === 'create' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setSignupMode('create');
                    setError(null);
                  }}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Créer un cabinet
                </Button>
                <Button
                  type="button"
                  variant={signupMode === 'join' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setSignupMode('join');
                    setError(null);
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Rejoindre
                </Button>
              </div>

              {/* Create Cabinet Form */}
              {signupMode === 'create' && (
                <form onSubmit={handleCreateCabinet} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-name">Nom complet</Label>
                    <Input
                      id="create-name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={createFullName}
                      onChange={(e) => setCreateFullName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-email">Email</Label>
                    <Input
                      id="create-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">Mot de passe</Label>
                    <PasswordInput
                      id="create-password"
                      placeholder="••••••••"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-confirm">Confirmer le mot de passe</Label>
                    <PasswordInput
                      id="create-confirm"
                      placeholder="••••••••"
                      value={createConfirmPassword}
                      onChange={(e) => setCreateConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer mon cabinet
                  </Button>
                </form>
              )}

              {/* Join Team Form */}
              {signupMode === 'join' && (
                <div className="space-y-4">
                  {/* Step 1: Enter code */}
                  <div className="space-y-2">
                    <Label htmlFor="join-code">Code Cabinet</Label>
                    <div className="flex gap-2">
                      <Input
                        id="join-code"
                        type="text"
                        placeholder="CAB-XXXX"
                        value={joinCode}
                        onChange={(e) => {
                          setJoinCode(e.target.value.toUpperCase());
                          setFoundOrg(null);
                          setBranches([]);
                        }}
                        disabled={loading || verifyingCode}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={loading || verifyingCode || joinCode.length < 4}
                        variant="secondary"
                      >
                        {verifyingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Vérifier
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Demandez ce code à l'administrateur de votre cabinet
                    </p>
                  </div>

                  {/* Step 2: If code verified, show org + branch + form */}
                  {foundOrg && (
                    <form onSubmit={handleJoinTeam} className="space-y-4">
                      <Alert className="border-primary bg-primary/5">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-primary">
                          Cabinet trouvé : <strong>{foundOrg.organization_name}</strong>
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2">
                        <Label htmlFor="join-branch">Établissement</Label>
                        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                          <SelectTrigger id="join-branch">
                            <SelectValue placeholder="Sélectionnez votre établissement" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.branch_id} value={branch.branch_id}>
                                {branch.branch_name}
                                {branch.branch_city && ` (${branch.branch_city})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="join-name">Nom complet</Label>
                        <Input
                          id="join-name"
                          type="text"
                          placeholder="Jean Dupont"
                          value={joinFullName}
                          onChange={(e) => setJoinFullName(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="join-email">Email</Label>
                        <Input
                          id="join-email"
                          type="email"
                          placeholder="votre@email.com"
                          value={joinEmail}
                          onChange={(e) => setJoinEmail(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="join-password">Mot de passe</Label>
                        <PasswordInput
                          id="join-password"
                          placeholder="••••••••"
                          value={joinPassword}
                          onChange={(e) => setJoinPassword(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="join-confirm">Confirmer le mot de passe</Label>
                        <PasswordInput
                          id="join-confirm"
                          placeholder="••••••••"
                          value={joinConfirmPassword}
                          onChange={(e) => setJoinConfirmPassword(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loading || !selectedBranch}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Rejoindre le cabinet
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2024 APPMATO GESTION - Tous droits réservés
        </p>
      </div>
    </div>
  );
};

export default Auth;