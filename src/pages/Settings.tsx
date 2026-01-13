import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings as SettingsIcon, User, Shield, Trash2, Loader2, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, Branch, AppRole } from '@/types/database.types';

interface TeamMember extends Profile {
  role?: AppRole;
}

const getRoleLabel = (role: AppRole): string => {
  const labels: Record<AppRole, string> = {
    admin: 'Expert (Admin)',
    manager: 'Expert (Manager)',
    collaborator: 'Collaborateur',
  };
  return labels[role] || 'Collaborateur';
};

const getRoleBadgeVariant = (role: AppRole): 'default' | 'secondary' | 'outline' => {
  switch (role) {
    case 'admin': return 'default';
    case 'manager': return 'secondary';
    default: return 'outline';
  }
};

export const Settings: React.FC = () => {
  const { user, profile, userRole, organization, branch } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
  });

  // UI-only check - Authorization enforced server-side via RLS policies
  // This controls UI visibility only; database operations are protected by has_role() in RLS
  const isExpert = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
      });
    }
    if (isExpert) {
      fetchTeamData();
    } else {
      setLoading(false);
    }
  }, [profile, isExpert, user]);

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const [profilesRes, branchesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('branches').select('*').order('name'),
        supabase.from('user_roles').select('*'),
      ]);

      if (profilesRes.data && rolesRes.data) {
        const rolesMap = new Map(rolesRes.data.map(r => [r.user_id, r.role]));
        const membersWithRoles = profilesRes.data.map(p => ({
          ...p,
          role: rolesMap.get(p.user_id!) as AppRole || 'collaborator',
        }));
        setMembers(membersWithRoles as TeamMember[]);
      }

      if (branchesRes.data) {
        setBranches(branchesRes.data as Branch[]);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      toast.error('Profil non trouvé');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name.trim(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Profil mis à jour avec succès');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(`Erreur : ${error.message || 'Impossible de mettre à jour le profil'}`);
    } finally {
      setSaving(false);
    }
  };

  const updateMemberRole = async (userId: string, newRole: AppRole) => {
    try {
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let error;
      if (existing) {
        ({ error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId));
      } else {
        ({ error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole }));
      }

      if (error) throw error;

      setMembers(prev =>
        prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m)
      );
      toast.success('Rôle mis à jour avec succès');
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(`Erreur : ${error.message || 'Impossible de mettre à jour le rôle'}`);
    }
  };

  const deleteMember = async (member: TeamMember) => {
    if (member.user_id === user?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }

    try {
      // Delete profile (this will cascade to user_roles if needed)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== member.id));
      toast.success(`${member.full_name} a été supprimé`);
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast.error(`Erreur : ${error.message || 'Impossible de supprimer le membre'}`);
    }
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return '—';
    return branches.find(b => b.id === branchId)?.name || '—';
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Paramètres
        </h1>
        <p className="text-muted-foreground">
          Gérez votre profil et les paramètres de votre compte
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Mon Profil
          </CardTitle>
          <CardDescription>
            Vos informations personnelles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder="Votre nom"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profileData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  L'email ne peut pas être modifié
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mon Rôle</Label>
                <div className="flex items-center gap-2 h-10 px-3 py-2 rounded-md border bg-muted">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <Badge variant={getRoleBadgeVariant(userRole || 'collaborator')}>
                    {getRoleLabel(userRole || 'collaborator')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le rôle est géré par un administrateur
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mon Établissement</Label>
                <div className="flex items-center gap-2 h-10 px-3 py-2 rounded-md border bg-muted">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{branch?.name || organization?.name || '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team Management (Expert only) */}
      {isExpert && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Utilisateurs du cabinet
            </CardTitle>
            <CardDescription>
              Gérez les membres de {organization?.name || 'votre cabinet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name}
                        {member.user_id === user?.id && (
                          <Badge variant="outline" className="ml-2">Vous</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email || '—'}
                      </TableCell>
                      <TableCell>{getBranchName(member.branch_id)}</TableCell>
                      <TableCell>
                        {member.user_id && member.user_id !== user?.id ? (
                          <Select
                            value={member.role || 'collaborator'}
                            onValueChange={(v) => updateMemberRole(member.user_id!, v as AppRole)}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Expert (Admin)</SelectItem>
                              <SelectItem value="manager">Expert (Manager)</SelectItem>
                              <SelectItem value="collaborator">Collaborateur</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role || 'collaborator')}>
                            {getRoleLabel(member.role || 'collaborator')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.user_id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce membre ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer <strong>{member.full_name}</strong> ?
                                  Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMember(member)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Aucun membre trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
