/* ==========================================================================
   model.js — Constantes du domaine, fabriques d'objets, validation, formatage.
   Aucune dépendance : ce fichier doit être chargé en premier.
   ========================================================================== */

/* Espace de noms global unique de l'application. */
window.WM = window.WM || {};

(function (WM) {
  'use strict';

  /* ---------- Constantes du domaine ---------- */

  /* Version du schéma stocké dans localStorage. À incrémenter en cas de
     changement de structure, puis ajouter une étape dans store.migrer(). */
  var VERSION_SCHEMA = 1;

  var DEVISES = [
    { code: 'EUR', libelle: 'Euro (€)' },
    { code: 'AED', libelle: 'Dirham (AED)' },
    { code: 'USD', libelle: 'Dollar US ($)' },
    { code: 'GBP', libelle: 'Livre sterling (£)' }
  ];
  var CODES_DEVISES = DEVISES.map(function (d) { return d.code; });

  var PRIORITES = ['Haute', 'Moyenne', 'Basse'];
  /* Poids de tri : la priorité haute doit remonter en premier. */
  var POIDS_PRIORITE = { 'Haute': 0, 'Moyenne': 1, 'Basse': 2 };

  var STATUTS = ['À acheter', 'En attente', 'Acheté', 'Abandonné'];
  /* Statuts pris en compte dans le budget « restant à dépenser ». */
  var STATUTS_A_BUDGETER = ['À acheter', 'En attente'];

  var CATEGORIES_DEFAUT = [
    'Mode & accessoires',
    'Beauté',
    'Maison & déco',
    'Tech & informatique',
    'Sport & fitness',
    'Livres & formation',
    'Voyage',
    'Art & créatif',
    'Autre'
  ];

  /* ---------- Identifiants ---------- */

  /* Génère un identifiant court, unique en pratique (préfixe + temps + aléa).
     On évite crypto.randomUUID() qui n'existe pas sur les navigateurs anciens. */
  function genererId(prefixe) {
    var aleatoire = Math.random().toString(36).slice(2, 8);
    var temps = Date.now().toString(36).slice(-5);
    return (prefixe || 'id') + '_' + temps + aleatoire;
  }

  /* ---------- Utilitaires de conversion ---------- */

  /* Convertit une valeur de formulaire en nombre, ou null si vide / invalide. */
  function versNombre(valeur) {
    if (valeur === null || valeur === undefined) return null;
    var texte = String(valeur).trim().replace(',', '.');
    if (texte === '') return null;
    var nombre = Number(texte);
    return isFinite(nombre) ? nombre : null;
  }

  function versTexte(valeur, longueurMax) {
    var texte = (valeur === null || valeur === undefined) ? '' : String(valeur).trim();
    if (longueurMax && texte.length > longueurMax) texte = texte.slice(0, longueurMax);
    return texte;
  }

  /* Vérifie qu'une URL est absolue et en http(s) — on refuse notamment
     javascript: qui serait injectable via un import JSON malveillant. */
  function estUrlValide(valeur) {
    var texte = versTexte(valeur);
    if (texte === '') return true; // champ optionnel : vide = valide
    try {
      var url = new URL(texte);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /* Renvoie l'URL si elle est sûre, sinon une chaîne vide.
     Utilisé au rendu pour ne jamais poser d'href/src douteux dans le DOM. */
  function urlSure(valeur) {
    return estUrlValide(valeur) ? versTexte(valeur) : '';
  }

  /* ---------- Fabriques ---------- */

  function creerListe(nom, demo) {
    return {
      id: genererId('lst'),
      nom: versTexte(nom, 60) || 'Sans titre',
      createdAt: new Date().toISOString(),
      demo: !!demo
    };
  }

  function creerCategorie(nom) {
    return { id: genererId('cat'), nom: versTexte(nom, 60) || 'Sans titre' };
  }

  /* Normalise un objet « article » : garantit la présence et le type de
     chaque champ, quelle que soit la source (formulaire, import JSON, démo). */
  function normaliserArticle(brut, listIdParDefaut, categorieIdParDefaut) {
    brut = brut || {};
    var statut = STATUTS.indexOf(brut.statut) !== -1 ? brut.statut : 'À acheter';
    var priorite = PRIORITES.indexOf(brut.priorite) !== -1 ? brut.priorite : 'Moyenne';
    var devise = CODES_DEVISES.indexOf(brut.devise) !== -1 ? brut.devise : 'EUR';
    var prixEstime = versNombre(brut.prixEstime);
    var prixPaye = versNombre(brut.prixPaye);

    return {
      id: versTexte(brut.id) || genererId('itm'),
      listId: versTexte(brut.listId) || listIdParDefaut,
      nom: versTexte(brut.nom, 120),
      categorieId: versTexte(brut.categorieId) || categorieIdParDefaut,
      sousCategorie: versTexte(brut.sousCategorie, 80),
      prixEstime: (prixEstime !== null && prixEstime >= 0) ? prixEstime : null,
      devise: devise,
      magasin: versTexte(brut.magasin, 120),
      url: urlSure(brut.url),
      imageUrl: urlSure(brut.imageUrl),
      priorite: priorite,
      statut: statut,
      dateAjout: versTexte(brut.dateAjout) || new Date().toISOString(),
      dateAchat: statut === 'Acheté' ? (versTexte(brut.dateAchat) || null) : null,
      prixPaye: (statut === 'Acheté' && prixPaye !== null && prixPaye >= 0) ? prixPaye : null,
      variantes: versTexte(brut.variantes, 160),
      occasion: versTexte(brut.occasion, 60),
      notes: versTexte(brut.notes, 1000),
      demo: !!brut.demo
    };
  }

  /* ---------- Validation du formulaire ---------- */

  /* Retourne un objet { champ: message }. Vide = formulaire valide.
     Les clés correspondent aux identifiants des champs du formulaire. */
  function validerArticle(brut) {
    var erreurs = {};

    if (versTexte(brut.nom) === '') {
      erreurs.nom = 'Le nom est obligatoire.';
    }

    var prix = String(brut.prixEstime === null || brut.prixEstime === undefined ? '' : brut.prixEstime).trim();
    if (prix !== '') {
      var valeurPrix = versNombre(prix);
      if (valeurPrix === null) erreurs.prix = 'Le prix doit être un nombre.';
      else if (valeurPrix < 0) erreurs.prix = 'Le prix doit être positif.';
      else if (valeurPrix > 1e12) erreurs.prix = 'Le prix est trop élevé.';
    }

    var paye = String(brut.prixPaye === null || brut.prixPaye === undefined ? '' : brut.prixPaye).trim();
    if (paye !== '') {
      var valeurPaye = versNombre(paye);
      if (valeurPaye === null) erreurs.prixPaye = 'Le prix payé doit être un nombre.';
      else if (valeurPaye < 0) erreurs.prixPaye = 'Le prix payé doit être positif.';
      else if (valeurPaye > 1e12) erreurs.prixPaye = 'Le prix payé est trop élevé.';
    }

    if (!estUrlValide(brut.url)) {
      erreurs.url = 'URL invalide : elle doit commencer par http:// ou https://';
    }
    if (!estUrlValide(brut.imageUrl)) {
      erreurs.image = 'URL d\'image invalide : elle doit commencer par http:// ou https://';
    }

    if (brut.statut === 'Acheté' && versTexte(brut.dateAchat) !== '') {
      var d = new Date(brut.dateAchat);
      if (isNaN(d.getTime())) erreurs.dateAchat = 'Date d\'achat invalide.';
    }

    return erreurs;
  }

  /* ---------- Formatage ---------- */

  /* Intl est natif : aucune librairie externe n'est nécessaire. */
  function formaterMontant(valeur, devise) {
    if (valeur === null || valeur === undefined || !isFinite(valeur)) return '—';
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: devise || 'EUR',
        maximumFractionDigits: 2
      }).format(valeur);
    } catch (e) {
      /* Repli si la devise n'est pas reconnue par le navigateur. */
      return valeur.toFixed(2) + ' ' + (devise || '');
    }
  }

  /* Date ISO -> « 11 août 2026 ». Renvoie '' si la date est absente/invalide. */
  function formaterDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  /* Date ISO -> « 2026-08-11 », format attendu par <input type="date">. */
  function versDateInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var mois = String(d.getMonth() + 1).padStart(2, '0');
    var jour = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mois + '-' + jour;
  }

  /* Exposition publique. */
  WM.model = {
    VERSION_SCHEMA: VERSION_SCHEMA,
    DEVISES: DEVISES,
    CODES_DEVISES: CODES_DEVISES,
    PRIORITES: PRIORITES,
    POIDS_PRIORITE: POIDS_PRIORITE,
    STATUTS: STATUTS,
    STATUTS_A_BUDGETER: STATUTS_A_BUDGETER,
    CATEGORIES_DEFAUT: CATEGORIES_DEFAUT,
    genererId: genererId,
    versNombre: versNombre,
    versTexte: versTexte,
    estUrlValide: estUrlValide,
    urlSure: urlSure,
    creerListe: creerListe,
    creerCategorie: creerCategorie,
    normaliserArticle: normaliserArticle,
    validerArticle: validerArticle,
    formaterMontant: formaterMontant,
    formaterDate: formaterDate,
    versDateInput: versDateInput
  };
})(window.WM);
