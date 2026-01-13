-- 1. Ajoute le champ tva_deadline_day dans la table dossiers
ALTER TABLE public.dossiers 
ADD COLUMN tva_deadline_day integer NOT NULL DEFAULT 21;

-- 2. Met à jour la fonction de génération avec la logique corrigée
CREATE OR REPLACE FUNCTION public.generate_fiscal_obligations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_month integer;
  v_due_date date;
  v_cloture_date date;
  v_deadline_day integer;
BEGIN
  -- Déterminer l'année fiscale (année courante)
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Récupérer le jour de deadline TVA personnalisé
  v_deadline_day := COALESCE(NEW.tva_deadline_day, 21);
  
  -- Générer les tâches TVA selon le mode
  IF NEW.tva_mode = 'mensuel' THEN
    -- 12 tâches TVA mensuelles
    FOR v_month IN 1..12 LOOP
      -- Date limite = jour personnalisé du mois suivant
      IF v_month = 12 THEN
        v_due_date := make_date(v_year + 1, 1, LEAST(v_deadline_day, 28));
      ELSE
        -- Gestion des mois courts (février, etc.)
        v_due_date := make_date(v_year, v_month + 1, LEAST(v_deadline_day, 
          CASE 
            WHEN v_month + 1 = 2 THEN 28
            WHEN v_month + 1 IN (4, 6, 9, 11) THEN 30
            ELSE 31
          END));
      END IF;
      
      INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
      VALUES (NEW.id, 'TVA'::tache_type, v_due_date, 'a_faire'::tache_statut, 
              'TVA ' || TO_CHAR(make_date(v_year, v_month, 1), 'TMMonth YYYY'));
    END LOOP;
  ELSIF NEW.tva_mode = 'trimestriel' THEN
    -- 4 tâches TVA trimestrielles
    -- T1 (Jan-Mar) -> limite personnalisée Avril
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year, 4, v_deadline_day), 'a_faire'::tache_statut, 'TVA T1 ' || v_year);
    -- T2 (Avr-Juin) -> limite personnalisée Juillet
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year, 7, v_deadline_day), 'a_faire'::tache_statut, 'TVA T2 ' || v_year);
    -- T3 (Jul-Sep) -> limite personnalisée Octobre
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year, 10, v_deadline_day), 'a_faire'::tache_statut, 'TVA T3 ' || v_year);
    -- T4 (Oct-Déc) -> limite personnalisée Janvier N+1
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year + 1, 1, v_deadline_day), 'a_faire'::tache_statut, 'TVA T4 ' || v_year);
  END IF;
  
  -- Générer les tâches IS si régime IS (UNIQUEMENT 5 tâches par an, JAMAIS mensuel)
  IF NEW.regime_fiscal = 'IS' THEN
    -- Acompte 1 : 15 Mars
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 3, 15), 'a_faire'::tache_statut, 'Acompte IS 1');
    -- Acompte 2 : 15 Juin
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 6, 15), 'a_faire'::tache_statut, 'Acompte IS 2');
    -- Acompte 3 : 15 Septembre
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 9, 15), 'a_faire'::tache_statut, 'Acompte IS 3');
    -- Acompte 4 : 15 Décembre
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 12, 15), 'a_faire'::tache_statut, 'Acompte IS 4');
    
    -- Solde IS : 15 Mai (ou 3,5 mois après clôture si défini)
    IF NEW.cloture IS NOT NULL THEN
      v_cloture_date := NEW.cloture;
      v_due_date := v_cloture_date + INTERVAL '3 months' + INTERVAL '15 days';
    ELSE
      v_due_date := make_date(v_year + 1, 5, 15);
    END IF;
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, v_due_date, 'a_faire'::tache_statut, 'Solde IS');
  END IF;
  
  -- Générer la tâche Liasse Fiscale (date clôture + 3 mois si défini, sinon 30 avril)
  IF NEW.cloture IS NOT NULL THEN
    v_cloture_date := NEW.cloture;
    v_due_date := v_cloture_date + INTERVAL '3 months';
  ELSE
    v_due_date := make_date(v_year + 1, 4, 30);
  END IF;
  INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
  VALUES (NEW.id, 'LIASSE'::tache_type, v_due_date, 'a_faire'::tache_statut, 'Bilan / Liasse Fiscale ' || v_year);
  
  -- CFE : 15 décembre
  INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
  VALUES (NEW.id, 'CFE'::tache_type, make_date(v_year, 12, 15), 'a_faire'::tache_statut, 'CFE ' || v_year);
  
  -- CVAE : 3 mai
  INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
  VALUES (NEW.id, 'CVAE'::tache_type, make_date(v_year + 1, 5, 3), 'a_faire'::tache_statut, 'CVAE ' || v_year);

  RETURN NEW;
END;
$function$;