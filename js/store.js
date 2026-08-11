/* ==========================================================================
   store.js — Persistance localStorage : lecture, écriture, migration,
   validation d'un fichier importé et jeu de données de démonstration.
   Dépend de : model.js
   ========================================================================== */

(function (WM) {
  'use strict';

  var M = WM.model;

  /* Clé versionnée : une future v2 utilisera `wishlist_data_v2` et la
     fonction migrer() se chargera de convertir l'ancien contenu. */
  var CLE = 'wishlist_data_v1';
  /* Anciennes clés connues, examinées si la clé courante est absente. */
  var CLES_HERITEES = [];

  /* Indique si localStorage est réellement utilisable (mode privé de certains
     navigateurs, cookies bloqués, ouverture depuis file:// sur Safari…). */
  var disponible = (function () {
    try {
      var test = '__wm_test__';
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  })();

  /* Repli mémoire : l'application reste utilisable pour la session en cours,
     mais l'utilisateur est averti que rien ne sera conservé. */
  var memoire = null;

  /* ---------- Structure par défaut ---------- */

  function structureParDefaut() {
    var categories = M.CATEGORIES_DEFAUT.map(function (nom) { return M.creerCategorie(nom); });
    var listePrincipale = M.creerListe('Ma wishlist');
    return {
      version: M.VERSION_SCHEMA,
      updatedAt: new Date().toISOString(),
      settings: {
        theme: 'light',
        view: 'cards',
        defaultCurrency: 'EUR',
        activeListId: listePrincipale.id,
        demoLoaded: false
      },
      categories: categories,
      lists: [listePrincipale],
      items: []
    };
  }

  /* ---------- Normalisation / migration ---------- */

  /* Applique les migrations successives puis normalise l'ensemble.
     Toute donnée douteuse est réparée plutôt que rejetée : l'objectif est
     de ne jamais bloquer l'utilisateur sur un stockage partiellement corrompu. */
  function migrer(brut) {
    var data = (brut && typeof brut === 'object') ? brut : {};

    /* Emplacement des futures migrations :
       if (data.version === 1) { ...transformer vers la v2...; data.version = 2; } */

    var defaut = structureParDefaut();

    /* --- Catégories --- */
    var categories = Array.isArray(data.categories) ? data.categories : [];
    categories = categories
      .filter(function (c) { return c && typeof c === 'object'; })
      .map(function (c) {
        return { id: M.versTexte(c.id) || M.genererId('cat'), nom: M.versTexte(c.nom, 60) || 'Sans titre' };
      });
    if (categories.length === 0) categories = defaut.categories;

    /* On garantit l'existence d'une catégorie de repli nommée « Autre ». */
    var repli = trouverCategorieAutre(categories);
    if (!repli) {
      repli = M.creerCategorie('Autre');
      categories.push(repli);
    }

    /* --- Wishlists --- */
    var lists = Array.isArray(data.lists) ? data.lists : [];
    lists = lists
      .filter(function (l) { return l && typeof l === 'object'; })
      .map(function (l) {
        return {
          id: M.versTexte(l.id) || M.genererId('lst'),
          nom: M.versTexte(l.nom, 60) || 'Sans titre',
          createdAt: M.versTexte(l.createdAt) || new Date().toISOString(),
          demo: !!l.demo
        };
      });
    if (lists.length === 0) lists = defaut.lists;

    var idsListes = lists.map(function (l) { return l.id; });
    var idsCategories = categories.map(function (c) { return c.id; });

    /* --- Articles --- */
    var items = Array.isArray(data.items) ? data.items : [];
    items = items
      .filter(function (i) { return i && typeof i === 'object'; })
      .map(function (i) { return M.normaliserArticle(i, lists[0].id, repli.id); })
      /* Un article orphelin (liste ou catégorie disparue) est rattaché
         plutôt que supprimé, pour ne perdre aucune donnée. */
      .map(function (i) {
        if (idsListes.indexOf(i.listId) === -1) i.listId = lists[0].id;
        if (idsCategories.indexOf(i.categorieId) === -1) i.categorieId = repli.id;
        return i;
      })
      .filter(function (i) { return i.nom !== ''; });

    /* --- Réglages --- */
    var s = (data.settings && typeof data.settings === 'object') ? data.settings : {};
    var settings = {
      theme: (s.theme === 'dark') ? 'dark' : 'light',
      view: (s.view === 'list') ? 'list' : 'cards',
      defaultCurrency: M.CODES_DEVISES.indexOf(s.defaultCurrency) !== -1 ? s.defaultCurrency : 'EUR',
      activeListId: idsListes.indexOf(M.versTexte(s.activeListId)) !== -1 ? s.activeListId : lists[0].id,
      demoLoaded: !!s.demoLoaded
    };

    return {
      version: M.VERSION_SCHEMA,
      updatedAt: M.versTexte(data.updatedAt) || new Date().toISOString(),
      settings: settings,
      categories: categories,
      lists: lists,
      items: items
    };
  }

  /* Recherche la catégorie de repli (« Autre »), insensible à la casse. */
  function trouverCategorieAutre(categories) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].nom.toLowerCase() === 'autre') return categories[i];
    }
    return null;
  }

  /* ---------- Lecture / écriture ---------- */

  function charger() {
    if (!disponible) {
      if (!memoire) memoire = structureParDefaut();
      return memoire;
    }
    var brut = null;
    try {
      brut = window.localStorage.getItem(CLE);
      if (brut === null) {
        /* Aucune donnée sous la clé courante : on tente les clés héritées. */
        for (var i = 0; i < CLES_HERITEES.length && brut === null; i++) {
          brut = window.localStorage.getItem(CLES_HERITEES[i]);
        }
      }
    } catch (e) {
      brut = null;
    }

    if (brut === null) return structureParDefaut(); // premier lancement

    try {
      return migrer(JSON.parse(brut));
    } catch (e) {
      /* Contenu illisible : on sauvegarde l'original sous une clé de secours
         pour ne rien détruire, et on repart d'une structure propre. */
      try { window.localStorage.setItem(CLE + '_corrompu_' + Date.now(), brut); } catch (e2) { /* ignoré */ }
      return structureParDefaut();
    }
  }

  /* Retourne { ok: true } ou { ok: false, code, message }. */
  function sauvegarder(data) {
    data.updatedAt = new Date().toISOString();
    if (!disponible) {
      memoire = data;
      return { ok: false, code: 'indisponible',
               message: 'Stockage local indisponible : les modifications ne seront pas conservées après fermeture.' };
    }
    try {
      window.localStorage.setItem(CLE, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      /* Le quota (~5 Mo) est le cas d'erreur le plus probable ; il survient
         surtout avec beaucoup d'articles ou de longues notes. */
      var estQuota = e && (e.name === 'QuotaExceededError' ||
                           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                           e.code === 22 || e.code === 1014);
      return {
        ok: false,
        code: estQuota ? 'quota' : 'erreur',
        message: estQuota
          ? 'Espace de stockage saturé : la modification n\'a pas pu être enregistrée. Exportez vos données en JSON, puis supprimez des articles ou des images.'
          : 'Enregistrement impossible : ' + (e && e.message ? e.message : 'erreur inconnue') + '.'
      };
    }
  }

  function effacer() {
    if (!disponible) { memoire = null; return; }
    try { window.localStorage.removeItem(CLE); } catch (e) { /* ignoré */ }
  }

  /* Taille approximative occupée, en Ko, pour information à l'utilisateur. */
  function tailleUtilisee() {
    if (!disponible) return 0;
    try {
      var brut = window.localStorage.getItem(CLE);
      return brut ? Math.round((brut.length * 2) / 1024) : 0; // ~2 octets par caractère (UTF-16)
    } catch (e) {
      return 0;
    }
  }

  /* ---------- Validation d'un import ---------- */

  /* Vérifie la forme générale d'un fichier importé avant migration.
     Retourne { ok: true, data } ou { ok: false, message }. */
  function validerImport(texte) {
    var objet;
    try {
      objet = JSON.parse(texte);
    } catch (e) {
      return { ok: false, message: 'Fichier illisible : ce n\'est pas du JSON valide.' };
    }
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
      return { ok: false, message: 'Structure inattendue : le fichier doit contenir un objet JSON.' };
    }
    if (!Array.isArray(objet.items) || !Array.isArray(objet.lists)) {
      return { ok: false, message: 'Structure inattendue : les champs « items » et « lists » sont requis.' };
    }
    if (objet.version !== undefined && Number(objet.version) > M.VERSION_SCHEMA) {
      return { ok: false, message: 'Ce fichier provient d\'une version plus récente de l\'application (v' +
                                   objet.version + '). Mettez l\'application à jour avant d\'importer.' };
    }
    return { ok: true, data: migrer(objet) };
  }

  /* ---------- Données de démonstration ---------- */

  /* Renvoie une date ISO située il y a `jours` jours. */
  function ilYA(jours) {
    var d = new Date();
    d.setDate(d.getDate() - jours);
    return d.toISOString();
  }

  /* Ajoute les listes et articles de démo à une structure existante.
     Tout est marqué `demo: true` pour permettre un effacement en un clic. */
  function ajouterDemo(data) {
    function idCategorie(nom) {
      for (var i = 0; i < data.categories.length; i++) {
        if (data.categories[i].nom === nom) return data.categories[i].id;
      }
      var creee = M.creerCategorie(nom);
      data.categories.push(creee);
      return creee.id;
    }

    var appart = M.creerListe('Appartement', true);
    var perso = M.creerListe('Perso', true);
    var cadeaux = M.creerListe('Cadeaux', true);
    data.lists.push(appart, perso, cadeaux);

    var brouillon = [
      { listId: appart.id, nom: 'Canapé 3 places en velours', categorie: 'Maison & déco', sousCategorie: 'Salon',
        prixEstime: 899, devise: 'EUR', magasin: 'Maisons du Monde', url: 'https://www.maisonsdumonde.com/',
        priorite: 'Haute', statut: 'À acheter', occasion: 'Déménagement', variantes: 'Vert sapin',
        notes: 'Mesurer la largeur du mur avant de commander.', dateAjout: ilYA(24) },
      { listId: appart.id, nom: 'Lampadaire arc laiton', categorie: 'Maison & déco', sousCategorie: 'Éclairage',
        prixEstime: 189.9, devise: 'EUR', magasin: 'La Redoute Intérieurs', priorite: 'Moyenne',
        statut: 'En attente', occasion: 'Déménagement', notes: 'Attendre les soldes.', dateAjout: ilYA(19) },
      { listId: appart.id, nom: 'Robot cuiseur multifonction', categorie: 'Tech & informatique',
        sousCategorie: 'Électroménager', prixEstime: 749, devise: 'EUR', magasin: 'Boulanger',
        priorite: 'Basse', statut: 'À acheter',
        notes: 'Comparer avec le modèle de l\'an dernier.', dateAjout: ilYA(15) },
      { listId: appart.id, nom: 'Enceinte multiroom', categorie: 'Tech & informatique', prixEstime: 179,
        devise: 'EUR', magasin: 'Sonos', url: 'https://www.sonos.com/', priorite: 'Basse',
        statut: 'À acheter', occasion: 'Déménagement', dateAjout: ilYA(9) },
      { listId: appart.id, nom: 'Affiche encadrée A2', categorie: 'Art & créatif', prixEstime: 89,
        devise: 'EUR', magasin: 'Desenio', priorite: 'Moyenne', statut: 'En attente',
        variantes: 'Cadre chêne clair', notes: 'Choisir le visuel avec le salon terminé.', dateAjout: ilYA(4) },
      { listId: appart.id, nom: 'Tapis berbère 160×230', categorie: 'Maison & déco', prixEstime: 1200,
        devise: 'AED', magasin: 'Souk — Dubaï', priorite: 'Moyenne', statut: 'À acheter',
        occasion: 'Voyage', notes: 'Négocier le prix sur place.', dateAjout: ilYA(12) },
      { listId: appart.id, nom: 'Étagère murale chêne', categorie: 'Maison & déco', prixEstime: 79,
        devise: 'EUR', magasin: 'IKEA', priorite: 'Basse', statut: 'Acheté', prixPaye: 65,
        dateAchat: ilYA(6), occasion: 'Déménagement', dateAjout: ilYA(30) },

      { listId: perso.id, nom: 'Casque audio à réduction de bruit', categorie: 'Tech & informatique',
        prixEstime: 349, devise: 'EUR', magasin: 'Fnac', url: 'https://www.fnac.com/',
        priorite: 'Haute', statut: 'Acheté', prixPaye: 299, dateAchat: ilYA(9),
        notes: 'Acheté pendant les French Days.', dateAjout: ilYA(45) },
      { listId: perso.id, nom: 'Manteau en laine long', categorie: 'Mode & accessoires', sousCategorie: 'Manteaux',
        prixEstime: 220, devise: 'EUR', magasin: 'COS', priorite: 'Haute', statut: 'À acheter',
        occasion: 'Hiver', variantes: 'Taille M / camel', dateAjout: ilYA(8) },
      { listId: perso.id, nom: 'Sérum vitamine C', categorie: 'Beauté', prixEstime: 39.9, devise: 'EUR',
        magasin: 'Sephora', priorite: 'Moyenne', statut: 'À acheter', dateAjout: ilYA(7) },
      { listId: perso.id, nom: 'Tapis de yoga antidérapant', categorie: 'Sport & fitness', prixEstime: 55,
        devise: 'EUR', magasin: 'Decathlon', priorite: 'Basse', statut: 'Abandonné',
        notes: 'Finalement fourni par la salle.', dateAjout: ilYA(40) },
      { listId: perso.id, nom: 'Formation UX Design', categorie: 'Livres & formation', prixEstime: 480,
        devise: 'USD', magasin: 'Interaction Design Foundation', priorite: 'Moyenne', statut: 'En attente',
        notes: 'Vérifier si l\'employeur peut la financer.', dateAjout: ilYA(21) },
      { listId: perso.id, nom: 'Carnet de croquis A4', categorie: 'Art & créatif', prixEstime: 18.5,
        devise: 'EUR', magasin: 'Rougier & Plé', priorite: 'Basse', statut: 'À acheter', dateAjout: ilYA(3) },

      { listId: cadeaux.id, nom: 'Coffret thé japonais', categorie: 'Autre', prixEstime: 45, devise: 'EUR',
        magasin: 'Palais des Thés', priorite: 'Haute', statut: 'À acheter', occasion: 'Anniversaire',
        notes: 'Pour Léa — anniversaire en septembre.', dateAjout: ilYA(5) },
      { listId: cadeaux.id, nom: 'Roman policier islandais', categorie: 'Livres & formation', prixEstime: 22,
        devise: 'GBP', magasin: 'Waterstones', priorite: 'Moyenne', statut: 'À acheter',
        occasion: 'Noël', dateAjout: ilYA(2) },
      { listId: cadeaux.id, nom: 'Week-end thermes', categorie: 'Voyage', prixEstime: 260, devise: 'EUR',
        magasin: 'Balnéa', priorite: 'Moyenne', statut: 'En attente', occasion: 'Anniversaire',
        notes: 'À réserver au moins un mois à l\'avance.', dateAjout: ilYA(11) }
    ];

    brouillon.forEach(function (b) {
      b.categorieId = idCategorie(b.categorie);
      b.demo = true;
      data.items.push(M.normaliserArticle(b, b.listId, b.categorieId));
    });

    data.settings.activeListId = appart.id;
    data.settings.demoLoaded = true;
    return data;
  }

  /* Supprime tout ce qui est marqué comme démo (listes et articles).
     Une liste de démo dans laquelle l'utilisateur a ajouté ses propres
     articles est conservée : seuls ses articles de démo disparaissent. */
  function retirerDemo(data) {
    var articlesConserves = data.items.filter(function (i) { return !i.demo; });

    var listesAConserver = {};
    articlesConserves.forEach(function (i) { listesAConserver[i.listId] = true; });

    data.lists = data.lists.filter(function (l) { return !l.demo || listesAConserver[l.id]; });
    data.lists.forEach(function (l) { if (l.demo) l.demo = false; });

    var idsListes = data.lists.map(function (l) { return l.id; });
    data.items = articlesConserves.filter(function (i) { return idsListes.indexOf(i.listId) !== -1; });
    /* Il doit toujours rester au moins une wishlist utilisable. */
    if (data.lists.length === 0) data.lists.push(M.creerListe('Ma wishlist'));
    var ids = data.lists.map(function (l) { return l.id; });
    if (ids.indexOf(data.settings.activeListId) === -1) data.settings.activeListId = data.lists[0].id;
    data.settings.demoLoaded = false;
    return data;
  }

  WM.store = {
    CLE: CLE,
    disponible: disponible,
    structureParDefaut: structureParDefaut,
    migrer: migrer,
    charger: charger,
    sauvegarder: sauvegarder,
    effacer: effacer,
    tailleUtilisee: tailleUtilisee,
    validerImport: validerImport,
    ajouterDemo: ajouterDemo,
    retirerDemo: retirerDemo,
    trouverCategorieAutre: trouverCategorieAutre
  };
})(window.WM);
