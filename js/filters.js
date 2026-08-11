/* ==========================================================================
   filters.js — Recherche, filtres combinables, tri et calculs du tableau
   de bord. Fonctions pures : aucune manipulation du DOM ici.
   Dépend de : model.js
   ========================================================================== */

(function (WM) {
  'use strict';

  var M = WM.model;

  /* Normalise une chaîne pour la recherche : minuscules et sans accents,
     afin que « beauté » corresponde aussi à « beaute ». */
  function normaliser(texte) {
    var s = String(texte === null || texte === undefined ? '' : texte).toLowerCase();
    /* normalize() est disponible partout depuis longtemps ; on protège quand même. */
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* ignoré */ }
    return s;
  }

  /* ---------- Filtrage ---------- */

  /* criteres = { listId, recherche, categorieId, statut, priorite, occasion, prixMin, prixMax } */
  function appliquerFiltres(items, criteres) {
    var c = criteres || {};
    var recherche = normaliser(c.recherche || '');
    var prixMin = M.versNombre(c.prixMin);
    var prixMax = M.versNombre(c.prixMax);

    return items.filter(function (item) {
      if (c.listId && item.listId !== c.listId) return false;
      if (c.categorieId && item.categorieId !== c.categorieId) return false;
      if (c.statut && item.statut !== c.statut) return false;
      if (c.priorite && item.priorite !== c.priorite) return false;
      if (c.occasion && item.occasion !== c.occasion) return false;

      /* Fourchette de prix appliquée au prix estimé, sans distinction de
         devise (aucune conversion n'est réalisée dans l'application). */
      if (prixMin !== null || prixMax !== null) {
        if (item.prixEstime === null) return false;
        if (prixMin !== null && item.prixEstime < prixMin) return false;
        if (prixMax !== null && item.prixEstime > prixMax) return false;
      }

      /* Recherche texte sur le nom, le magasin et les notes
         (les variantes et la sous-catégorie sont incluses par confort). */
      if (recherche !== '') {
        var champs = normaliser(
          item.nom + ' ' + item.magasin + ' ' + item.notes + ' ' +
          item.variantes + ' ' + item.sousCategorie + ' ' + item.occasion
        );
        if (champs.indexOf(recherche) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- Tri ---------- */

  /* Les articles sans prix sont renvoyés en fin de liste quel que soit le sens. */
  function comparerPrix(a, b, sens) {
    var pa = a.prixEstime, pb = b.prixEstime;
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return (pa - pb) * sens;
  }

  function trier(items, cle) {
    var copie = items.slice(); // on ne modifie jamais le tableau source
    switch (cle) {
      case 'prix-asc':
        copie.sort(function (a, b) { return comparerPrix(a, b, 1); });
        break;
      case 'prix-desc':
        copie.sort(function (a, b) { return comparerPrix(a, b, -1); });
        break;
      case 'date-asc':
        copie.sort(function (a, b) { return new Date(a.dateAjout) - new Date(b.dateAjout); });
        break;
      case 'priorite':
        copie.sort(function (a, b) {
          var d = M.POIDS_PRIORITE[a.priorite] - M.POIDS_PRIORITE[b.priorite];
          /* À priorité égale, l'article le plus récent d'abord. */
          return d !== 0 ? d : new Date(b.dateAjout) - new Date(a.dateAjout);
        });
        break;
      case 'nom-asc':
        copie.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }); });
        break;
      case 'date-desc':
      default:
        copie.sort(function (a, b) { return new Date(b.dateAjout) - new Date(a.dateAjout); });
    }
    return copie;
  }

  /* ---------- Statistiques du tableau de bord ---------- */

  /* Ajoute un montant dans un dictionnaire { devise: total }. */
  function cumuler(dictionnaire, devise, montant) {
    if (montant === null || !isFinite(montant)) return;
    dictionnaire[devise] = (dictionnaire[devise] || 0) + montant;
  }

  /* Transforme { EUR: 120, AED: 50 } en « 120,00 € · 50,00 AED ». */
  function formaterTotaux(dictionnaire) {
    var codes = Object.keys(dictionnaire).filter(function (d) { return dictionnaire[d] > 0; });
    if (codes.length === 0) return '—';
    codes.sort();
    return codes.map(function (code) {
      return M.formaterMontant(dictionnaire[code], code);
    }).join(' · ');
  }

  /* Calcule tous les indicateurs sur la liste **déjà filtrée**.
     - budget estimé : articles « À acheter » et « En attente »
     - dépensé : articles « Acheté », prix payé si renseigné, sinon prix estimé
     - répartition : montant estimé par catégorie, groupé par devise */
  function calculerStats(items, categories) {
    var budget = {};        // { devise: total estimé restant }
    var depense = {};       // { devise: total dépensé }
    var repartition = {};   // { devise: { categorieId: montant } }
    var parStatut = {};
    var nbBudgete = {};     // { devise: nombre d'articles budgétés }
    var depenseEstimee = false; // au moins un achat sans prix payé saisi

    M.STATUTS.forEach(function (s) { parStatut[s] = 0; });

    items.forEach(function (item) {
      parStatut[item.statut] = (parStatut[item.statut] || 0) + 1;

      if (item.statut === 'Acheté') {
        var paye = item.prixPaye;
        if (paye === null) {
          paye = item.prixEstime;              // repli sur le prix estimé
          if (paye !== null) depenseEstimee = true;
        }
        cumuler(depense, item.devise, paye);
        return;
      }

      if (M.STATUTS_A_BUDGETER.indexOf(item.statut) === -1) return; // « Abandonné » : ignoré

      if (item.prixEstime !== null) nbBudgete[item.devise] = (nbBudgete[item.devise] || 0) + 1;
      cumuler(budget, item.devise, item.prixEstime);
      if (item.prixEstime !== null && item.prixEstime > 0) {
        if (!repartition[item.devise]) repartition[item.devise] = {};
        repartition[item.devise][item.categorieId] =
          (repartition[item.devise][item.categorieId] || 0) + item.prixEstime;
      }
    });

    /* Panier moyen : chaque devise est divisée par son propre nombre
       d'articles, sinon la moyenne mélangerait des unités différentes. */
    var moyenne = {};
    Object.keys(budget).forEach(function (code) {
      if (nbBudgete[code]) moyenne[code] = budget[code] / nbBudgete[code];
    });

    /* Mise en forme de la répartition : une entrée par devise, catégories
       triées par montant décroissant, avec un pourcentage pour la largeur des barres. */
    var nomsCategories = {};
    categories.forEach(function (c) { nomsCategories[c.id] = c.nom; });

    var groupes = Object.keys(repartition).sort().map(function (code) {
      var parCategorie = repartition[code];
      var total = Object.keys(parCategorie).reduce(function (somme, id) { return somme + parCategorie[id]; }, 0);
      var lignes = Object.keys(parCategorie).map(function (id) {
        return {
          categorieId: id,
          nom: nomsCategories[id] || 'Catégorie supprimée',
          montant: parCategorie[id],
          pourcentage: total > 0 ? (parCategorie[id] / total) * 100 : 0
        };
      }).sort(function (a, b) { return b.montant - a.montant; });
      return { devise: code, total: total, lignes: lignes };
    });

    return {
      nombre: items.length,
      parStatut: parStatut,
      budget: budget,
      budgetTexte: formaterTotaux(budget),
      depense: depense,
      depenseTexte: formaterTotaux(depense),
      depenseEstimee: depenseEstimee,
      moyenneTexte: formaterTotaux(moyenne),
      repartition: groupes
    };
  }

  /* Liste dédupliquée et triée des occasions présentes dans les articles,
     utilisée pour le filtre « occasion » et l'autocomplétion du formulaire. */
  function collecterOccasions(items) {
    var vues = {};
    items.forEach(function (i) { if (i.occasion) vues[i.occasion] = true; });
    return Object.keys(vues).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }

  WM.filters = {
    normaliser: normaliser,
    appliquerFiltres: appliquerFiltres,
    trier: trier,
    calculerStats: calculerStats,
    collecterOccasions: collecterOccasions,
    formaterTotaux: formaterTotaux
  };
})(window.WM);
