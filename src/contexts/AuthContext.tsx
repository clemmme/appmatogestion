import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Organization, Branch, AppRole } from '@/types/database.types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: AppRole | null;
  organization: Organization | null;
  branch: Branch | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, cabinetName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // 1. Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) console.error('Error fetching profile:', profileError);

      if (profileData) {
        setProfile(profileData as Profile);

        // 2. Fetch organization
        if (profileData.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .maybeSingle();
          setOrganization(orgData as Organization);
        }

        // 3. Fetch branch
        if (profileData.branch_id) {
          const { data: branchData } = await supabase
            .from('branches')
            .select('*')
            .eq('id', profileData.branch_id)
            .maybeSingle();
          setBranch(branchData as Branch);
        }
      }

      // 4. Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role as AppRole);
      } else {
        // Fallback: Si pas de rôle trouvé mais qu'il y a une organisation, c'est louche.
        setUserRole(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Petit délai pour laisser le temps aux triggers DB éventuels
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 500);
        } else {
          setProfile(null);
          setUserRole(null);
          setOrganization(null);
          setBranch(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error as Error | null };
  };

  // 🔴 CORRECTION MAJEURE ICI : Création explicite des données
  const signUp = async (email: string, password: string, fullName: string, cabinetName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // 1. Création du compte Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          // On garde les métadonnées au cas où, mais on ne compte plus dessus
          cabinet_name: cabinetName || fullName, 
        },
      },
    });

    if (authError || !authData.user) {
      return { error: authError as Error | null };
    }

    // 2. Si un nom de cabinet est fourni, on force la création des données relationnelles
    // On attend un peu que l'utilisateur soit bien propagé en base
    if (cabinetName) {
      try {
        // A. Créer l'organisation manuellement
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert([{ name: cabinetName }])
          .select()
          .single();

        if (orgError) throw orgError;

        if (newOrg) {
          // B. Attribuer le rôle OWNER (C'est ça qui te manquait !)
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: 'owner', // Force le rôle OWNER
              organization_id: newOrg.id
            });
            
          if (roleError) console.error("Erreur création rôle:", roleError);

          // C. Lier le profil à l'organisation
          // Note : Le profil est souvent créé par un trigger "on_auth_user_created". 
          // On fait un UPDATE pour être sûr.
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              organization_id: newOrg.id,
              full_name: fullName
            })
            .eq('user_id', authData.user.id);

          // Si le profil n'existe pas encore (lag du trigger), on tente un upsert
          if (profileError) {
             await supabase.from('profiles').upsert({
                user_id: authData.user.id,
                organization_id: newOrg.id,
                full_name: fullName,
                email: email
             });
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation du cabinet:", err);
        // On ne bloque pas le signup, mais l'user devra contacter le support ou réessayer
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setOrganization(null);
    setBranch(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        organization,
        branch,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
