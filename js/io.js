/* ==========================================================================
   io.js — Export JSON, export CSV et lecture d'un fichier importé.
   Tout se passe dans le navigateur : aucun envoi réseau.
   Dépend de : model.js, store.js
   ========================================================================== */

(function (WM) {
  'use strict';

  var M = WM.model;

  /* Déclenche le téléchargement d'un contenu texte via un Blob local. */
  function telecharger(nomFichier, contenu, typeMime) {
    var blob = new Blob([contenu], { type: typeMime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    /* On libère l'URL objet un peu plus tard : certains navigateurs
       annulent le téléchargement si elle est révoquée immédiatement. */
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* Horodatage compact pour les noms de fichiers : 2026-08-11_0930. */
  function horodatage() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           '_' + p(d.getHours()) + p(d.getMinutes());
  }

  /* Nettoie une chaîne pour l'utiliser dans un nom de fichier. */
  function slug(texte) {
    return WM.filters.normaliser(texte).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wishlist';
  }

  /* ---------- Export JSON ---------- */

  function exporterJSON(data) {
    telecharger('wishlist-manager_' + horodatage() + '.json',
                JSON.stringify(data, null, 2),
                'application/json');
  }

  /* ---------- Export CSV ---------- */

  /* Échappe une valeur pour le CSV et neutralise les formules :
     un champ commençant par = + - @ est préfixé d'une apostrophe pour
     éviter qu'un tableur ne l'interprète comme une formule. */
  function champCsv(valeur) {
    var texte = (valeur === null || valeur === undefined) ? '' : String(valeur);
    if (/^[=+\-@\t\r]/.test(texte)) texte = "'" + texte;
    return '"' + texte.replace(/"/g, '""') + '"';
  }

  /* Les nombres sont écrits avec une virgule décimale, cohérente avec le
     séparateur point-virgule attendu par les tableurs francophones. */
  function nombreCsv(valeur) {
    if (valeur === null || valeur === undefined) return '';
    return String(valeur).replace('.', ',');
  }

  function exporterCSV(items, categories, nomListe) {
    var nomsCategories = {};
    categories.forEach(function (c) { nomsCategories[c.id] = c.nom; });

    var entetes = ['Nom', 'Catégorie', 'Sous-catégorie', 'Prix estimé', 'Devise', 'Magasin', 'URL',
                   'Priorité', 'Statut', 'Date d\'ajout', 'Date d\'achat', 'Prix payé',
                   'Variantes', 'Occasion', 'Notes', 'Image'];

    var lignes = [entetes.map(champCsv).join(';')];

    items.forEach(function (i) {
      lignes.push([
        champCsv(i.nom),
        champCsv(nomsCategories[i.categorieId] || ''),
        champCsv(i.sousCategorie),
        nombreCsv(i.prixEstime),
        champCsv(i.devise),
        champCsv(i.magasin),
        champCsv(i.url),
        champCsv(i.priorite),
        champCsv(i.statut),
        champCsv(M.versDateInput(i.dateAjout)),
        champCsv(M.versDateInput(i.dateAchat)),
        nombreCsv(i.prixPaye),
        champCsv(i.variantes),
        champCsv(i.occasion),
        champCsv(i.notes.replace(/\r?\n/g, ' ')),
        champCsv(i.imageUrl)
      ].join(';'));
    });

    /* Le BOM UTF-8 garantit l'affichage correct des accents dans Excel. */
    var contenu = '\uFEFF' + lignes.join('\r\n') + '\r\n';
    telecharger('wishlist_' + slug(nomListe) + '_' + horodatage() + '.csv', contenu, 'text/csv');
  }

  /* ---------- Import ---------- */

  /* Lit un fichier local et renvoie son contenu texte via un callback.
     FileReader fonctionne aussi en file:// sur les navigateurs courants. */
  function lireFichier(fichier, surSucces, surErreur) {
    if (!fichier) { surErreur('Aucun fichier sélectionné.'); return; }
    if (fichier.size > 20 * 1024 * 1024) {
      surErreur('Fichier trop volumineux (limite : 20 Mo).');
      return;
    }
    var lecteur = new FileReader();
    lecteur.onload = function () { surSucces(String(lecteur.result)); };
    lecteur.onerror = function () { surErreur('Lecture du fichier impossible.'); };
    lecteur.readAsText(fichier);
  }

  /* Fusionne les données importées dans les données courantes.
     - les catégories sont appariées par nom (insensible à la casse)
     - les wishlists sont appariées par nom ; sinon elles sont créées
     - les articles reçoivent systématiquement un nouvel identifiant afin
       d'éviter toute collision avec l'existant */
  function fusionner(courant, importe) {
    var indexCategories = {};
    courant.categories.forEach(function (c) { indexCategories[c.nom.toLowerCase()] = c.id; });

    var mappingCategories = {};
    importe.categories.forEach(function (c) {
      var cle = c.nom.toLowerCase();
      if (!indexCategories[cle]) {
        var nouvelle = M.creerCategorie(c.nom);
        courant.categories.push(nouvelle);
        indexCategories[cle] = nouvelle.id;
      }
      mappingCategories[c.id] = indexCategories[cle];
    });

    var indexListes = {};
    courant.lists.forEach(function (l) { indexListes[l.nom.toLowerCase()] = l.id; });

    var mappingListes = {};
    importe.lists.forEach(function (l) {
      var cle = l.nom.toLowerCase();
      if (!indexListes[cle]) {
        var nouvelle = M.creerListe(l.nom);
        courant.lists.push(nouvelle);
        indexListes[cle] = nouvelle.id;
      }
      mappingListes[l.id] = indexListes[cle];
    });

    var ajoutes = 0;
    importe.items.forEach(function (i) {
      var copie = JSON.parse(JSON.stringify(i));
      copie.id = M.genererId('itm');
      /* Un article importé est une donnée utilisateur : il ne doit pas être
         balayé par le bouton « Effacer les données de démo ». */
      copie.demo = false;
      copie.listId = mappingListes[i.listId] || courant.settings.activeListId;
      copie.categorieId = mappingCategories[i.categorieId] ||
                          (WM.store.trouverCategorieAutre(courant.categories) || courant.categories[0]).id;
      courant.items.push(copie);
      ajoutes++;
    });

    return { data: courant, ajoutes: ajoutes };
  }

  WM.io = {
    telecharger: telecharger,
    exporterJSON: exporterJSON,
    exporterCSV: exporterCSV,
    lireFichier: lireFichier,
    fusionner: fusionner
  };
})(window.WM);
