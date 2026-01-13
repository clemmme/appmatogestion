-- Fonction pour générer automatiquement les obligations fiscales à la création d'un dossier
CREATE OR REPLACE FUNCTION public.generate_fiscal_obligations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_year integer;
  v_month integer;
  v_due_date date;
  v_cloture_date date;
  v_cloture_month integer;
BEGIN
  -- Déterminer l'année fiscale (année courante)
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Générer les tâches TVA selon le mode
  IF NEW.tva_mode = 'mensuel' THEN
    -- 12 tâches TVA mensuelles
    FOR v_month IN 1..12 LOOP
      -- Date limite = 21 du mois suivant
      IF v_month = 12 THEN
        v_due_date := make_date(v_year + 1, 1, 21);
      ELSE
        v_due_date := make_date(v_year, v_month + 1, 21);
      END IF;
      
      INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
      VALUES (NEW.id, 'TVA'::tache_type, v_due_date, 'a_faire'::tache_statut, 
              'TVA ' || TO_CHAR(make_date(v_year, v_month, 1), 'TMMonth YYYY'));
    END LOOP;
  ELSIF NEW.tva_mode = 'trimestriel' THEN
    -- 4 tâches TVA trimestrielles (T1, T2, T3, T4)
    -- T1 (Jan-Mar) -> limite 21 Avril
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year, 4, 21), 'a_faire'::tache_statut, 'TVA T1 ' || v_year);
    -- T2 (Avr-Juin) -> limite 21 Juillet
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year, 7, 21), 'a_faire'::tache_statut, 'TVA T2 ' || v_year);
    -- T3 (Jul-Sep) -> limite 21 Octobre
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year, 10, 21), 'a_faire'::tache_statut, 'TVA T3 ' || v_year);
    -- T4 (Oct-Déc) -> limite 21 Janvier N+1
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'TVA'::tache_type, make_date(v_year + 1, 1, 21), 'a_faire'::tache_statut, 'TVA T4 ' || v_year);
  END IF;
  
  -- Générer les tâches IS si régime IS
  IF NEW.regime_fiscal = 'IS' THEN
    -- 4 acomptes IS (15/03, 15/06, 15/09, 15/12)
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 3, 15), 'a_faire'::tache_statut, 'Acompte IS 1 - ' || v_year);
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 6, 15), 'a_faire'::tache_statut, 'Acompte IS 2 - ' || v_year);
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 9, 15), 'a_faire'::tache_statut, 'Acompte IS 3 - ' || v_year);
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, make_date(v_year, 12, 15), 'a_faire'::tache_statut, 'Acompte IS 4 - ' || v_year);
    
    -- Solde IS (date clôture + 4 mois si défini, sinon 15 mai)
    IF NEW.cloture IS NOT NULL THEN
      v_cloture_date := NEW.cloture;
      v_due_date := v_cloture_date + INTERVAL '4 months' - INTERVAL '1 day';
    ELSE
      v_due_date := make_date(v_year + 1, 5, 15);
    END IF;
    INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
    VALUES (NEW.id, 'IS'::tache_type, v_due_date, 'a_faire'::tache_statut, 'Solde IS ' || v_year);
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
  
  -- Générer les taxes annexes (CFE, CVAE)
  -- CFE : 15 décembre
  INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
  VALUES (NEW.id, 'CFE'::tache_type, make_date(v_year, 12, 15), 'a_faire'::tache_statut, 'CFE ' || v_year);
  
  -- CVAE : 3 mai (si applicable - on crée pour tous, peut être mis en "néant")
  INSERT INTO public.taches_fiscales (dossier_id, type, date_echeance, statut, commentaire)
  VALUES (NEW.id, 'CVAE'::tache_type, make_date(v_year + 1, 5, 3), 'a_faire'::tache_statut, 'CVAE ' || v_year);

  RETURN NEW;
END;
$function$;

-- Créer le trigger sur la table dossiers
DROP TRIGGER IF EXISTS trigger_generate_fiscal_obligations ON public.dossiers;
CREATE TRIGGER trigger_generate_fiscal_obligations
  AFTER INSERT ON public.dossiers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_fiscal_obligations();