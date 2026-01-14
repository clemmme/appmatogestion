import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  Settings,
  Building2,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const mainNavItems: NavItem[] = [
  { label: 'Tableau de bord', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Dossiers', icon: FolderOpen, href: '/dossiers' },
  { label: 'Import', icon: Upload, href: '/import' },
];

const adminNavItems: NavItem[] = [
  { label: 'Établissements', icon: Building2, href: '/branches' },
  { label: 'Paramètres', icon: Settings, href: '/settings' },
];

export const AppSidebar: React.FC = () => {
  const { pathname } = useLocation();
  const { profile, organization, branch, userRole, signOut } = useAuth();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex flex-col w-64 bg-sidebar text-sidebar-foreground h-screen">
      {/* Logo & Org */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">APPMATO</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {organization?.name || 'Gestion Fiscale'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="mb-2">
          <p className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-2">
            Principal
          </p>
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'nav-item',
                isActive(item.href) ? 'nav-item-active' : 'nav-item-inactive'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {(userRole === 'admin' || userRole === 'manager') && (
          <div className="pt-4">
            <p className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-2">
              Administration
            </p>
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'nav-item',
                  isActive(item.href) ? 'nav-item-active' : 'nav-item-inactive'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-primary-foreground">
                  {profile?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || 'Utilisateur'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {branch?.name || 'Collaborateur'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};
