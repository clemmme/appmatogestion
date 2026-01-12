import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Users as UsersIcon, Shield, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, Branch, AppRole } from '@/types/database.types';

interface TeamMember extends Profile {
  role?: AppRole;
}

export const Users: React.FC = () => {
  const { organization, userRole } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    full_name: '',
    role: 'collaborator' as AppRole,
    branch_id: '',
  });

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
        if (branchesRes.data.length > 0 && !inviteData.branch_id) {
          setInviteData(prev => ({ ...prev, branch_id: branchesRes.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return '—';
    return branches.find(b => b.id === branchId)?.name || '—';
  };

  const getRoleBadge = (role: AppRole) => {
    const config = {
      admin: { label: 'Admin', variant: 'default' as const, icon: Shield },
      manager: { label: 'Manager', variant: 'secondary' as const, icon: User },
      collaborator: { label: 'Collaborateur', variant: 'outline' as const, icon: User },
    };
    const { label, variant, icon: Icon } = config[role] || config.collaborator;
    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) {
      toast.error('Organisation non trouvée');
      return;
    }

    setSaving(true);
    try {
      // Create profile for the invited user (they will need to sign up with this email)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          full_name: inviteData.full_name.trim(),
          email: inviteData.email.trim().toLowerCase(),
          organization_id: organization.id,
          branch_id: inviteData.branch_id || null,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      toast.success(`Invitation envoyée à ${inviteData.email}`);
      setMembers(prev => [...prev, { ...profile, role: inviteData.role } as TeamMember]);
      setInviteModalOpen(false);
      setInviteData({
        email: '',
        full_name: '',
        role: 'collaborator',
        branch_id: branches[0]?.id || '',
      });
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || 'Erreur lors de l\'invitation');
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (userId: string, newRole: AppRole) => {
    try {
      // Check if role exists
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
      }

      setMembers(prev =>
        prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m)
      );
      toast.success('Rôle mis à jour');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
          <p className="text-muted-foreground">
            Seuls les administrateurs peuvent gérer les utilisateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion équipe</h1>
          <p className="text-muted-foreground">
            Gérez les collaborateurs de {organization?.name || 'votre cabinet'}
          </p>
        </div>

        <Button onClick={() => setInviteModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Inviter un collaborateur
        </Button>
      </div>

      <div className="card-professional overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Établissement</TableHead>
              <TableHead>Rôle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{member.email || '—'}</TableCell>
                <TableCell>{getBranchName(member.branch_id)}</TableCell>
                <TableCell>
                  {member.user_id ? (
                    <Select
                      value={member.role || 'collaborator'}
                      onValueChange={(v) => updateRole(member.user_id!, v as AppRole)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="collaborator">Collaborateur</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">En attente</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {loading ? 'Chargement...' : 'Aucun collaborateur'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un collaborateur</DialogTitle>
            <DialogDescription>
              Le collaborateur recevra un email pour créer son compte.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nom complet *</Label>
              <Input
                id="full_name"
                value={inviteData.full_name}
                onChange={(e) => setInviteData({ ...inviteData, full_name: e.target.value })}
                placeholder="Jean Dupont"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="jean@cabinet.fr"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(v) => setInviteData({ ...inviteData, role: v as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Expert)</SelectItem>
                    <SelectItem value="manager">Manager (Expert)</SelectItem>
                    <SelectItem value="collaborator">Collaborateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Établissement</Label>
                <Select
                  value={inviteData.branch_id}
                  onValueChange={(v) => setInviteData({ ...inviteData, branch_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !inviteData.full_name.trim() || !inviteData.email.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
