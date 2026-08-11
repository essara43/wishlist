/* ==========================================================================
   app.js — Point d'entrée : état de l'application, câblage des événements
   et orchestration du rendu.
   Dépend de : model.js, store.js, filters.js, io.js, ui.js
   ========================================================================== */

(function (WM) {
  'use strict';

  var M = WM.model;
  var store = WM.store;
  var F = WM.filters;
  var UI = WM.ui;
  var el = UI.el;

  /* ---------- État ---------- */

  var data = null;          // structure complète persistée
  var articleEnCours = null; // id de l'article en cours d'édition, null = création

  /* Critères d'affichage (non persistés : ils repartent à zéro à chaque visite). */
  var criteres = {
    recherche: '',
    categorieId: '',
    statut: '',
    priorite: '',
    occasion: '',
    prixMin: '',
    prixMax: ''
  };
  var tri = 'date-desc';

  /* ---------- Accès aux données ---------- */

  function listeActive() {
    for (var i = 0; i < data.lists.length; i++) {
      if (data.lists[i].id === data.settings.activeListId) return data.lists[i];
    }
    return data.lists[0];
  }

  function articleParId(id) {
    for (var i = 0; i < data.items.length; i++) {
      if (data.items[i].id === id) return data.items[i];
    }
    return null;
  }

  function compterArticles(listId) {
    return data.items.filter(function (i) { return i.listId === listId; }).length;
  }

  function idCategorieRepli() {
    var autre = store.trouverCategorieAutre(data.categories);
    return (autre || data.categories[0]).id;
  }

  /* Enregistre puis signale à l'utilisateur tout problème de persistance. */
  function persister() {
    var resultat = store.sauvegarder(data);
    if (!resultat.ok) UI.toast(resultat.message, 'erreur');
    return resultat.ok;
  }

  /* ---------- Rendu ---------- */

  function rendre() {
    rendreSelecteurListe();
    rendreOptionsFiltres();

    var criteresComplets = {
      listId: data.settings.activeListId,
      recherche: criteres.recherche,
      categorieId: criteres.categorieId,
      statut: criteres.statut,
      priorite: criteres.priorite,
      occasion: criteres.occasion,
      prixMin: criteres.prixMin,
      prixMax: criteres.prixMax
    };

    var visibles = F.trier(F.appliquerFiltres(data.items, criteresComplets), tri);
    var totalListe = compterArticles(data.settings.activeListId);

    UI.rendreDashboard(F.calculerStats(visibles, data.categories));
    UI.rendreArticles(visibles, data.settings.view, data.categories, totalListe === 0);

    el('resume-resultats').textContent =
      visibles.length + ' article' + (visibles.length > 1 ? 's' : '') + ' affiché' +
      (visibles.length > 1 ? 's' : '') + ' sur ' + totalListe + ' dans « ' + listeActive().nom + ' »';

    rendrePastilleFiltres();
    majBoutonsVue();
  }

  function rendreSelecteurListe() {
    var valeurs = data.lists.map(function (l) {
      return { valeur: l.id, libelle: l.nom + ' (' + compterArticles(l.id) + ')' };
    });
    UI.remplirSelect(el('select-liste'), valeurs, data.settings.activeListId);
  }

  function rendreOptionsFiltres() {
    var categories = data.categories.map(function (c) { return { valeur: c.id, libelle: c.nom }; });
    UI.remplirSelect(el('filtre-categorie'), categories, criteres.categorieId, 'Toutes');
    UI.remplirSelect(el('filtre-statut'), M.STATUTS, criteres.statut, 'Tous');
    UI.remplirSelect(el('filtre-priorite'), M.PRIORITES, criteres.priorite, 'Toutes');

    /* Les occasions proposées proviennent des articles de la liste active. */
    var articlesListe = data.items.filter(function (i) { return i.listId === data.settings.activeListId; });
    var occasions = F.collecterOccasions(articlesListe);
    UI.remplirSelect(el('filtre-occasion'), occasions, criteres.occasion, 'Toutes');

    /* Autocomplétion du champ « occasion » du formulaire, toutes listes confondues. */
    var datalist = el('liste-occasions');
    UI.vider(datalist);
    F.collecterOccasions(data.items).forEach(function (o) {
      datalist.appendChild(UI.creer('option', { attrs: { value: o } }));
    });
  }

  function rendrePastilleFiltres() {
    var actifs = ['categorieId', 'statut', 'priorite', 'occasion', 'prixMin', 'prixMax']
      .filter(function (cle) { return criteres[cle] !== '' && criteres[cle] !== null; }).length;
    var pastille = el('pastille-filtres');
    pastille.textContent = String(actifs);
    pastille.hidden = actifs === 0;
  }

  function majBoutonsVue() {
    var enCartes = data.settings.view === 'cards';
    el('btn-vue-cartes').setAttribute('aria-pressed', String(enCartes));
    el('btn-vue-liste').setAttribute('aria-pressed', String(!enCartes));
  }

  /* ---------- Formulaire article ---------- */

  var CHAMPS_ERREUR = {
    nom: 'err-nom', prix: 'err-prix', url: 'err-url', image: 'err-image',
    prixPaye: 'err-prix-paye', dateAchat: 'err-date-achat'
  };
  var CHAMPS_SAISIE = {
    nom: 'f-nom', prix: 'f-prix', url: 'f-url', image: 'f-image',
    prixPaye: 'f-prix-paye', dateAchat: 'f-date-achat'
  };

  function effacerErreurs() {
    Object.keys(CHAMPS_ERREUR).forEach(function (cle) {
      var noeud = el(CHAMPS_ERREUR[cle]);
      noeud.textContent = '';
      noeud.hidden = true;
      el(CHAMPS_SAISIE[cle]).removeAttribute('aria-invalid');
    });
  }

  function afficherErreurs(erreurs) {
    var premier = null;
    Object.keys(erreurs).forEach(function (cle) {
      var idErreur = CHAMPS_ERREUR[cle];
      if (!idErreur) return;
      var noeud = el(idErreur);
      noeud.textContent = erreurs[cle];
      noeud.hidden = false;
      var saisie = el(CHAMPS_SAISIE[cle]);
      saisie.setAttribute('aria-invalid', 'true');
      if (!premier) premier = saisie;
    });
    if (premier) premier.focus();
  }

  /* Affiche les champs propres à l'achat uniquement quand le statut le justifie. */
  function majChampsAchat() {
    var achete = el('f-statut').value === 'Acheté';
    el('bloc-date-achat').hidden = !achete;
    el('bloc-prix-paye').hidden = !achete;
    if (achete && el('f-date-achat').value === '') {
      el('f-date-achat').value = M.versDateInput(new Date().toISOString());
    }
  }

  function ouvrirFormulaireArticle(id) {
    articleEnCours = id || null;
    effacerErreurs();

    UI.remplirSelect(el('f-categorie'),
      data.categories.map(function (c) { return { valeur: c.id, libelle: c.nom }; }));
    UI.remplirSelect(el('f-devise'),
      M.DEVISES.map(function (d) { return { valeur: d.code, libelle: d.libelle }; }));
    UI.remplirSelect(el('f-priorite'), M.PRIORITES);
    UI.remplirSelect(el('f-statut'), M.STATUTS);

    var item = id ? articleParId(id) : null;
    el('titre-modale-article').textContent = item ? 'Modifier l\'article' : 'Nouvel article';

    el('f-nom').value = item ? item.nom : '';
    el('f-categorie').value = item ? item.categorieId : idCategorieRepli();
    el('f-sous-categorie').value = item ? item.sousCategorie : '';
    el('f-prix').value = (item && item.prixEstime !== null) ? item.prixEstime : '';
    el('f-devise').value = item ? item.devise : data.settings.defaultCurrency;
    el('f-magasin').value = item ? item.magasin : '';
    el('f-url').value = item ? item.url : '';
    el('f-image').value = item ? item.imageUrl : '';
    el('f-occasion').value = item ? item.occasion : '';
    el('f-priorite').value = item ? item.priorite : 'Moyenne';
    el('f-statut').value = item ? item.statut : 'À acheter';
    el('f-date-achat').value = item ? M.versDateInput(item.dateAchat) : '';
    el('f-prix-paye').value = (item && item.prixPaye !== null) ? item.prixPaye : '';
    el('f-variantes').value = item ? item.variantes : '';
    el('f-notes').value = item ? item.notes : '';

    majChampsAchat();
    UI.ouvrirModale('modale-article', 'f-nom');
  }

  function soumettreFormulaireArticle(evenement) {
    evenement.preventDefault();
    effacerErreurs();

    var brut = {
      nom: el('f-nom').value,
      categorieId: el('f-categorie').value,
      sousCategorie: el('f-sous-categorie').value,
      prixEstime: el('f-prix').value,
      devise: el('f-devise').value,
      magasin: el('f-magasin').value,
      url: el('f-url').value,
      imageUrl: el('f-image').value,
      priorite: el('f-priorite').value,
      statut: el('f-statut').value,
      dateAchat: el('f-date-achat').value,
      prixPaye: el('f-prix-paye').value,
      variantes: el('f-variantes').value,
      occasion: el('f-occasion').value,
      notes: el('f-notes').value
    };

    var erreurs = M.validerArticle(brut);
    if (Object.keys(erreurs).length > 0) {
      afficherErreurs(erreurs);
      return;
    }

    /* Une date d'achat vide sur un article acheté est renseignée au jour même. */
    if (brut.statut === 'Acheté') {
      brut.dateAchat = brut.dateAchat
        ? new Date(brut.dateAchat + 'T12:00:00').toISOString()
        : new Date().toISOString();
    }

    if (articleEnCours) {
      var existant = articleParId(articleEnCours);
      brut.id = existant.id;
      brut.listId = existant.listId;
      brut.dateAjout = existant.dateAjout;
      brut.demo = existant.demo;
      var index = data.items.indexOf(existant);
      data.items[index] = M.normaliserArticle(brut, existant.listId, idCategorieRepli());
    } else {
      brut.listId = data.settings.activeListId;
      data.items.push(M.normaliserArticle(brut, data.settings.activeListId, idCategorieRepli()));
    }

    if (persister()) {
      UI.toast(articleEnCours ? 'Article modifié.' : 'Article ajouté.', 'succes');
    }
    UI.fermerModale('modale-article');
    rendre();
  }

  /* ---------- Actions sur un article ---------- */

  function basculerAchat(item) {
    if (item.statut === 'Acheté') {
      item.statut = 'À acheter';
      item.dateAchat = null;
      item.prixPaye = null;
    } else {
      item.statut = 'Acheté';
      item.dateAchat = new Date().toISOString();
    }
    persister();
    rendre();
  }

  function supprimerArticle(item) {
    UI.confirmer('Supprimer définitivement « ' + item.nom + ' » ?', 'Supprimer').then(function (ok) {
      if (!ok) return;
      data.items = data.items.filter(function (i) { return i.id !== item.id; });
      if (persister()) UI.toast('Article supprimé.', 'succes');
      rendre();
    });
  }

  /* ---------- Gestion des wishlists ---------- */

  function rendreModaleListes() {
    var conteneur = el('liste-wishlists');
    UI.vider(conteneur);
    data.lists.forEach(function (liste) {
      conteneur.appendChild(UI.rendreLigneGestion(
        liste, compterArticles(liste.id), 'renommer-liste', 'supprimer-liste', data.lists.length > 1
      ));
    });
  }

  function supprimerListe(id) {
    var liste = data.lists.filter(function (l) { return l.id === id; })[0];
    if (!liste || data.lists.length <= 1) return;
    var nombre = compterArticles(id);
    var message = 'Supprimer la wishlist « ' + liste.nom + ' »' +
                  (nombre > 0 ? ' et ses ' + nombre + ' article(s) ?' : ' ?');
    UI.confirmer(message, 'Supprimer').then(function (ok) {
      if (!ok) return;
      data.lists = data.lists.filter(function (l) { return l.id !== id; });
      data.items = data.items.filter(function (i) { return i.listId !== id; });
      if (data.settings.activeListId === id) data.settings.activeListId = data.lists[0].id;
      persister();
      rendreModaleListes();
      rendre();
      UI.toast('Wishlist supprimée.', 'succes');
    });
  }

  /* ---------- Gestion des catégories ---------- */

  function rendreModaleCategories() {
    var conteneur = el('liste-categories');
    UI.vider(conteneur);
    data.categories.forEach(function (categorie) {
      var nombre = data.items.filter(function (i) { return i.categorieId === categorie.id; }).length;
      conteneur.appendChild(UI.rendreLigneGestion(
        categorie, nombre, 'renommer-categorie', 'supprimer-categorie', data.categories.length > 1
      ));
    });
  }

  function supprimerCategorie(id) {
    var categorie = data.categories.filter(function (c) { return c.id === id; })[0];
    if (!categorie || data.categories.length <= 1) return;
    var nombre = data.items.filter(function (i) { return i.categorieId === id; }).length;
    var message = nombre > 0
      ? 'Supprimer la catégorie « ' + categorie.nom + ' » ? Ses ' + nombre + ' article(s) seront reclassés dans « Autre ».'
      : 'Supprimer la catégorie « ' + categorie.nom + ' » ?';

    UI.confirmer(message, 'Supprimer').then(function (ok) {
      if (!ok) return;
      data.categories = data.categories.filter(function (c) { return c.id !== id; });
      /* La catégorie de repli est recréée si c'est « Autre » qui vient d'être supprimée. */
      var repli = store.trouverCategorieAutre(data.categories);
      if (!repli) {
        repli = M.creerCategorie('Autre');
        data.categories.push(repli);
      }
      data.items.forEach(function (i) { if (i.categorieId === id) i.categorieId = repli.id; });
      if (criteres.categorieId === id) criteres.categorieId = '';
      persister();
      rendreModaleCategories();
      rendre();
      UI.toast('Catégorie supprimée.', 'succes');
    });
  }

  /* ---------- Données : export, import, démo, réinitialisation ---------- */

  function majInfoStockage() {
    var taille = store.tailleUtilisee();
    el('info-stockage').textContent = store.disponible
      ? 'Stockage local utilisé : environ ' + taille + ' Ko (clé « ' + store.CLE + ' »). ' +
        data.items.length + ' article(s) au total.'
      : 'Stockage local indisponible : les données ne survivront pas à la fermeture de l\'onglet.';
  }

  function importerFichier(fichier) {
    var zoneErreur = el('err-import');
    zoneErreur.hidden = true;
    zoneErreur.textContent = '';

    function echouer(message) {
      zoneErreur.textContent = message;
      zoneErreur.hidden = false;
      UI.toast('Import annulé : ' + message, 'erreur');
    }

    WM.io.lireFichier(fichier, function (texte) {
      var resultat = store.validerImport(texte);
      if (!resultat.ok) { echouer(resultat.message); return; }

      var mode = document.querySelector('input[name="mode-import"]:checked').value;
      var message = (mode === 'remplacement')
        ? 'Remplacer TOUTES vos données actuelles par le contenu du fichier (' +
          resultat.data.items.length + ' article(s)) ? Cette action est irréversible.'
        : 'Ajouter ' + resultat.data.items.length + ' article(s) du fichier à vos données actuelles ?';

      UI.confirmer(message, mode === 'remplacement' ? 'Remplacer' : 'Fusionner').then(function (ok) {
        if (!ok) { UI.toast('Import annulé.'); return; }
        if (mode === 'remplacement') {
          data = resultat.data;
        } else {
          data = WM.io.fusionner(data, resultat.data).data;
        }
        UI.appliquerTheme(data.settings.theme);
        if (persister()) UI.toast('Import réussi : ' + resultat.data.items.length + ' article(s).', 'succes');
          majInfoStockage();
        rendre();
      });
    }, echouer);
  }

  function reinitialiserTout() {
    UI.confirmer(
      'Réinitialiser toutes les données ? Wishlists, articles et catégories personnalisées seront définitivement supprimés. Pensez à exporter vos données avant.',
      'Tout supprimer'
    ).then(function (ok) {
      if (!ok) return;
      store.effacer();
      data = store.structureParDefaut();
      persister();
      UI.appliquerTheme(data.settings.theme);
      majInfoStockage();
      rendre();
      UI.toast('Toutes les données ont été réinitialisées.', 'succes');
    });
  }

  /* ---------- Câblage des événements ---------- */

  /* Petit anti-rebond pour ne pas re-rendre à chaque frappe. */
  function antiRebond(fonction, delai) {
    var minuteur = null;
    return function () {
      var args = arguments, contexte = this;
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { fonction.apply(contexte, args); }, delai);
    };
  }

  function cablerEvenements() {
    /* --- En-tête --- */
    el('select-liste').addEventListener('change', function () {
      data.settings.activeListId = this.value;
      criteres.occasion = '';
      persister();
      rendre();
    });

    el('btn-theme').addEventListener('click', function () {
      data.settings.theme = (data.settings.theme === 'dark') ? 'light' : 'dark';
      UI.appliquerTheme(data.settings.theme);
      persister();
    });

    el('btn-gerer-listes').addEventListener('click', function () {
      rendreModaleListes();
      UI.ouvrirModale('modale-listes', 'f-nouvelle-liste');
    });

    el('btn-gerer-categories').addEventListener('click', function () {
      rendreModaleCategories();
      UI.ouvrirModale('modale-categories', 'f-nouvelle-categorie');
    });

    el('btn-donnees').addEventListener('click', function () {
      majInfoStockage();
      UI.ouvrirModale('modale-donnees');
    });

    /* --- Barre d'outils --- */
    el('btn-nouvel-article').addEventListener('click', function () { ouvrirFormulaireArticle(null); });

    el('recherche').addEventListener('input', antiRebond(function () {
      criteres.recherche = el('recherche').value;
      rendre();
    }, 200));

    el('tri').addEventListener('change', function () { tri = this.value; rendre(); });

    el('btn-vue-cartes').addEventListener('click', function () {
      data.settings.view = 'cards'; persister(); rendre();
    });
    el('btn-vue-liste').addEventListener('click', function () {
      data.settings.view = 'list'; persister(); rendre();
    });

    /* --- Filtres --- */
    var liaisons = {
      'filtre-categorie': 'categorieId',
      'filtre-statut': 'statut',
      'filtre-priorite': 'priorite',
      'filtre-occasion': 'occasion'
    };
    Object.keys(liaisons).forEach(function (id) {
      el(id).addEventListener('change', function () {
        criteres[liaisons[id]] = this.value;
        rendre();
      });
    });

    ['filtre-prix-min', 'filtre-prix-max'].forEach(function (id) {
      el(id).addEventListener('input', antiRebond(function () {
        criteres[id === 'filtre-prix-min' ? 'prixMin' : 'prixMax'] = el(id).value;
        rendre();
      }, 300));
    });

    el('btn-reinit-filtres').addEventListener('click', function () {
      criteres = { recherche: '', categorieId: '', statut: '', priorite: '', occasion: '', prixMin: '', prixMax: '' };
      el('recherche').value = '';
      el('filtre-prix-min').value = '';
      el('filtre-prix-max').value = '';
      rendre();
      UI.toast('Filtres réinitialisés.');
    });

    /* --- Actions sur les articles (délégation d'événements) --- */
    el('zone-articles').addEventListener('click', function (evenement) {
      var bouton = evenement.target.closest('button[data-action]');
      if (!bouton) return;
      var item = articleParId(bouton.getAttribute('data-id'));
      if (!item) return;

      switch (bouton.getAttribute('data-action')) {
        case 'editer': ouvrirFormulaireArticle(item.id); break;
        case 'basculer-achat': basculerAchat(item); break;
        case 'supprimer': supprimerArticle(item); break;
      }
    });

    /* --- Formulaire article --- */
    el('form-article').addEventListener('submit', soumettreFormulaireArticle);
    el('f-statut').addEventListener('change', majChampsAchat);

    /* --- Modale wishlists --- */
    el('form-ajout-liste').addEventListener('submit', function (evenement) {
      evenement.preventDefault();
      var champ = el('f-nouvelle-liste');
      var nom = champ.value.trim();
      if (nom === '') { champ.focus(); return; }
      var nouvelle = M.creerListe(nom);
      data.lists.push(nouvelle);
      data.settings.activeListId = nouvelle.id;
      persister();
      champ.value = '';
      rendreModaleListes();
      rendre();
      UI.toast('Wishlist « ' + nouvelle.nom + ' » créée.', 'succes');
    });

    el('liste-wishlists').addEventListener('click', function (evenement) {
      var bouton = evenement.target.closest('button[data-action="supprimer-liste"]');
      if (bouton) supprimerListe(bouton.getAttribute('data-id'));
    });

    el('liste-wishlists').addEventListener('change', function (evenement) {
      var champ = evenement.target.closest('input[data-action="renommer-liste"]');
      if (!champ) return;
      var id = champ.getAttribute('data-id');
      var nom = champ.value.trim();
      var liste = data.lists.filter(function (l) { return l.id === id; })[0];
      if (!liste) return;
      if (nom === '') { champ.value = liste.nom; return; } // un nom vide est refusé
      liste.nom = M.versTexte(nom, 60);
      persister();
      rendre();
    });

    /* --- Modale catégories --- */
    el('form-ajout-categorie').addEventListener('submit', function (evenement) {
      evenement.preventDefault();
      var champ = el('f-nouvelle-categorie');
      var nom = champ.value.trim();
      if (nom === '') { champ.focus(); return; }
      var doublon = data.categories.some(function (c) { return c.nom.toLowerCase() === nom.toLowerCase(); });
      if (doublon) { UI.toast('Cette catégorie existe déjà.', 'erreur'); return; }
      data.categories.push(M.creerCategorie(nom));
      persister();
      champ.value = '';
      rendreModaleCategories();
      rendre();
      UI.toast('Catégorie ajoutée.', 'succes');
    });

    el('liste-categories').addEventListener('click', function (evenement) {
      var bouton = evenement.target.closest('button[data-action="supprimer-categorie"]');
      if (bouton) supprimerCategorie(bouton.getAttribute('data-id'));
    });

    el('liste-categories').addEventListener('change', function (evenement) {
      var champ = evenement.target.closest('input[data-action="renommer-categorie"]');
      if (!champ) return;
      var id = champ.getAttribute('data-id');
      var nom = champ.value.trim();
      var categorie = data.categories.filter(function (c) { return c.id === id; })[0];
      if (!categorie) return;
      if (nom === '') { champ.value = categorie.nom; return; }
      categorie.nom = M.versTexte(nom, 60);
      persister();
      rendre();
    });

    /* --- Modale données --- */
    el('btn-export-json').addEventListener('click', function () {
      WM.io.exporterJSON(data);
      UI.toast('Export JSON généré.', 'succes');
    });

    el('btn-export-csv').addEventListener('click', function () {
      var visibles = F.trier(F.appliquerFiltres(data.items, {
        listId: data.settings.activeListId,
        recherche: criteres.recherche,
        categorieId: criteres.categorieId,
        statut: criteres.statut,
        priorite: criteres.priorite,
        occasion: criteres.occasion,
        prixMin: criteres.prixMin,
        prixMax: criteres.prixMax
      }), tri);
      if (visibles.length === 0) { UI.toast('Aucun article à exporter.', 'erreur'); return; }
      WM.io.exporterCSV(visibles, data.categories, listeActive().nom);
      UI.toast('Export CSV généré (' + visibles.length + ' article(s)).', 'succes');
    });

    el('f-fichier-import').addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      var fichier = this.files[0];
      /* Le champ est vidé immédiatement : sans cela, re-sélectionner le même
         fichier après une annulation ne déclencherait aucun événement. */
      this.value = '';
      importerFichier(fichier);
    });

    el('btn-charger-demo').addEventListener('click', function () {
      if (data.settings.demoLoaded) { UI.toast('Les données de démo sont déjà présentes.'); return; }
      data = store.ajouterDemo(data);
      persister();
      majInfoStockage();
      rendre();
      UI.toast('Données de démonstration chargées.', 'succes');
    });

    el('btn-effacer-demo').addEventListener('click', function () {
      UI.confirmer('Effacer toutes les wishlists et articles de démonstration ?', 'Effacer').then(function (ok) {
        if (!ok) return;
        data = store.retirerDemo(data);
        persister();
        majInfoStockage();
        rendre();
        UI.toast('Données de démonstration effacées.', 'succes');
      });
    });

    el('btn-reset-total').addEventListener('click', reinitialiserTout);
  }

  /* ---------- PWA : service worker et installation ---------- */

  var evenementInstallation = null; // invite d'installation mise de côté

  function initPWA() {
    var bouton = el('btn-installer');

    /* Le service worker n'est disponible qu'en http(s) : en file://,
       l'enregistrement échoue avec une erreur de sécurité, sans conséquence
       pour le reste de l'application. */
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* ignoré */ });
    }

    /* Chrome émet cet événement lorsque l'application remplit ses critères
       d'installation. On l'intercepte pour proposer l'installation depuis
       notre propre bouton plutôt que depuis la seule icône de la barre d'adresse. */
    window.addEventListener('beforeinstallprompt', function (evenement) {
      evenement.preventDefault();
      evenementInstallation = evenement;
      bouton.hidden = false;
    });

    bouton.addEventListener('click', function () {
      if (!evenementInstallation) return;
      evenementInstallation.prompt();
      evenementInstallation.userChoice.then(function (choix) {
        if (choix && choix.outcome === 'accepted') UI.toast('Application installée.', 'succes');
        evenementInstallation = null;
        bouton.hidden = true;
      });
    });

    /* Installation lancée depuis le menu du navigateur : le bouton devient inutile. */
    window.addEventListener('appinstalled', function () {
      evenementInstallation = null;
      bouton.hidden = true;
      UI.toast('Application installée.', 'succes');
    });
  }

  /* ---------- Démarrage ---------- */

  function init() {
    data = store.charger();

    /* Premier lancement : on charge le jeu de démonstration, effaçable en un clic.
       La wishlist vide créée par défaut est retirée pour ne pas encombrer
       l'interface à côté des listes de démo. */
    if (!data.settings.demoLoaded && data.items.length === 0) {
      var idListeVide = (data.lists.length === 1) ? data.lists[0].id : null;
      data = store.ajouterDemo(data);
      if (idListeVide) {
        data.lists = data.lists.filter(function (l) { return l.id !== idListeVide; });
      }
      store.sauvegarder(data);
    }

    UI.appliquerTheme(data.settings.theme);
    el('tri').value = tri;

    if (!store.disponible) {
      var bandeau = el('bandeau-stockage');
      bandeau.textContent = 'Stockage local indisponible dans ce navigateur (navigation privée ou cookies bloqués) : ' +
                            'vos modifications seront perdues à la fermeture de l\'onglet. Pensez à exporter vos données en JSON.';
      bandeau.hidden = false;
    }

    cablerEvenements();
    initPWA();
    rendre();
  }

  /* Le script est chargé en fin de <body> : le DOM est prêt, mais on reste
     prudent si le fichier venait à être déplacé dans <head>. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.WM);
