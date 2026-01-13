import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PricingSection } from '@/components/landing/PricingSection';
import { Footer } from '@/components/landing/Footer';
import { CookieBanner } from '@/components/landing/CookieBanner';
import { 
  ArrowRight, 
  Clock, 
  Bell, 
  Users, 
  CheckCircle,
  Shield
} from 'lucide-react';

const Index: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: Clock,
      title: 'Gain de temps',
      description: 'Automatisez le suivi de vos échéances et libérez des heures chaque semaine.',
    },
    {
      icon: Bell,
      title: 'Zéro oubli',
      description: 'Alertes intelligentes avant chaque deadline. Plus jamais de pénalités de retard.',
    },
    {
      icon: Users,
      title: 'Multi-collaborateurs',
      description: 'Partagez les dossiers avec votre équipe en temps réel, de partout.',
    },
  ];

  const stats = [
    { value: '500+', label: 'Dossiers gérés' },
    { value: '98%', label: 'Échéances respectées' },
    { value: '15h', label: 'Gagnées par mois' },
  ];

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-primary-foreground">A</span>
            </div>
            <span className="font-semibold text-lg">APPMATO</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={scrollToPricing} 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Tarifs
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Se connecter
            </Button>
            <Button onClick={() => navigate('/auth')} className="rounded-full px-6">
              Démarrer gratuitement
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Conçu pour les experts-comptables
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                La gestion fiscale{' '}
                <span className="text-primary">réinventée</span>
              </h1>
              
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Remplacez vos tableaux Excel par une interface moderne. 
                Suivez TVA, IS, CVAE et toutes vos obligations en un coup d'œil.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/auth')}
                  className="rounded-full px-8 h-14 text-base shadow-lg hover:shadow-xl transition-shadow"
                >
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={scrollToPricing}
                  className="rounded-full px-8 h-14 text-base"
                >
                  Voir les tarifs
                </Button>
              </div>

              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Essai gratuit • Aucune carte bancaire requise
              </p>
            </div>

            {/* Mockup */}
            <div className="relative lg:pl-8">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-3xl opacity-50" />
              <div className="relative bg-card rounded-2xl shadow-2xl border overflow-hidden transform lg:rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-status-done/50" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground font-medium">Tableau de bord</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {/* Mini stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'À faire', value: '12', color: 'bg-status-todo' },
                      { label: 'En cours', value: '8', color: 'bg-status-pending' },
                      { label: 'Terminés', value: '45', color: 'bg-status-done' },
                    ].map((stat, i) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/50 text-center">
                        <div className={`inline-flex w-2 h-2 rounded-full ${stat.color} mb-2`} />
                        <div className="text-xl font-bold">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mini table */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                      Prochaines échéances
                    </div>
                    {[
                      { name: 'SARL DUPONT', task: 'TVA Janvier', status: 'À faire' },
                      { name: 'SCI MARTIN', task: 'IS Acompte', status: 'En cours' },
                      { name: 'EURL PETIT', task: 'CVAE', status: 'Terminé' },
                    ].map((row, i) => (
                      <div key={i} className="px-4 py-3 border-t flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.task}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          row.status === 'Terminé' ? 'bg-status-done/10 text-status-done' :
                          row.status === 'En cours' ? 'bg-status-pending/10 text-status-pending' :
                          'bg-status-todo/10 text-status-todo'
                        }`}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Pourquoi choisir APPMATO ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Des outils pensés pour simplifier votre quotidien et booster la productivité de votre cabinet.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 rounded-3xl border bg-card hover:shadow-xl hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl gradient-primary p-12 lg:p-16 text-center text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGMxMC45MzcgMCAxOC04LjA1OSAxOC0xOHMtOC4wNTktMTgtMTgtMTh6bTAgMzJjLTcuNzMyIDAtMTQtNi4yNjgtMTQtMTRzNi4yNjgtMTQgMTQtMTQgMTQgNi4yNjggMTQgMTQtNi4yNjggMTQtMTQgMTR6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Prêt à transformer votre cabinet ?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                Rejoignez les experts-comptables qui ont déjà adopté APPMATO pour optimiser leur gestion fiscale.
              </p>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate('/auth')}
                className="rounded-full px-8 h-14 text-base shadow-lg"
              >
                Créer un compte gratuit
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Cookie Banner */}
      <CookieBanner />
    </div>
  );
};

export default Index;
