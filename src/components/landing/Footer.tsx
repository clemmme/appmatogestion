import React from 'react';
import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Mentions Légales', href: '#' },
  { label: 'CGU', href: '#' },
  { label: 'Politique de Confidentialité', href: '#' },
  { label: 'Contact', href: '#' },
];

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">A</span>
            </div>
            <div>
              <span className="font-semibold text-white">APPMATO GESTION</span>
              <p className="text-sm text-slate-400">La gestion fiscale réinventée</p>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} APPMATO GESTION. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>Conçu avec ❤️ en France</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
