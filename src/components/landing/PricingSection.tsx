import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 'Gratuit',
    description: 'Pour découvrir APPMATO',
    features: [
      '1 utilisateur',
      '5 dossiers clients',
      'Suivi TVA & IS',
      'Alertes email basiques',
      'Support par email',
    ],
    cta: 'Démarrer gratuitement',
  },
  {
    name: 'Pro',
    price: '29€',
    period: '/mois',
    description: 'Pour les cabinets en croissance',
    features: [
      'Jusqu\'à 3 utilisateurs',
      '50 dossiers clients',
      'Toutes les déclarations',
      'Assistant IA Basic',
      'Import Excel / CSV',
      'Support prioritaire',
    ],
    highlighted: true,
    cta: 'Essayer Pro',
  },
  {
    name: 'Cabinet',
    price: '99€',
    period: '/mois',
    description: 'Pour les cabinets établis',
    features: [
      'Utilisateurs illimités',
      'Dossiers illimités',
      'Multi-établissements',
      'Assistant IA Expert',
      'API & intégrations',
      'Support dédié 24/7',
      'Formation personnalisée',
    ],
    cta: 'Contacter les ventes',
  },
];

export const PricingSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Des tarifs simples et transparents
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choisissez la formule adaptée à la taille de votre cabinet. 
            Évoluez à tout moment.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {pricingTiers.map((tier, index) => (
            <Card
              key={index}
              className={cn(
                'relative flex flex-col transition-all duration-300 hover:shadow-xl',
                tier.highlighted && 'border-primary shadow-lg scale-[1.02]'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    <Sparkles className="w-3 h-3" />
                    Populaire
                  </span>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period && (
                    <span className="text-muted-foreground">{tier.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-status-done shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    'w-full mt-8',
                    tier.highlighted ? '' : 'variant-outline'
                  )}
                  variant={tier.highlighted ? 'default' : 'outline'}
                  onClick={() => navigate('/auth')}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          Tous les prix sont HT. Facturation mensuelle ou annuelle (-20%).
        </p>
      </div>
    </section>
  );
};
