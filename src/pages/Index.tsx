import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, Shield, Zap, Users } from 'lucide-react';

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
      icon: BarChart3,
      title: 'Vue Matricielle',
      description: 'Visualisez toutes vos échéances fiscales en un coup d\'œil',
    },
    {
      icon: Zap,
      title: 'Import Intelligent',
      description: 'Migrez vos tableaux Excel en quelques clics',
    },
    {
      icon: Shield,
      title: 'Sécurisé',
      description: 'Données isolées par cabinet, conforme RGPD',
    },
    {
      icon: Users,
      title: 'Multi-établissements',
      description: 'Gérez plusieurs sites depuis une seule interface',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="container mx-auto px-6 py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-status-done animate-pulse" />
              SaaS pour experts-comptables
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Gérez vos obligations fiscales{' '}
              <span className="text-primary">sans effort</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              APPMATO GESTION remplace vos tableaux Excel complexes par une
              interface intuitive. Suivez TVA, IS, CVAE et plus encore pour tous
              vos dossiers clients.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => navigate('/auth')}>
                Commencer gratuitement
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
                Se connecter
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Conçu pour les cabinets comptables
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Une solution complète pour centraliser et automatiser le suivi de
            toutes vos échéances fiscales.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card-professional p-6 hover:scale-[1.02] transition-transform"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-6 py-20">
        <div className="card-professional p-12 text-center gradient-primary text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">
            Prêt à simplifier votre gestion fiscale ?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Rejoignez les cabinets qui ont déjà adopté APPMATO GESTION pour
            optimiser leur productivité.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/auth')}
          >
            Créer un compte
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">A</span>
              </div>
              <span className="font-semibold">APPMATO GESTION</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 APPMATO GESTION. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
