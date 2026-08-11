/* ==========================================================================
   ui.js — Rendu du DOM, gestion des modales (piège de focus, Échap),
   notifications éphémères et bascule de thème.
   Les nœuds sont construits par createElement/textContent : aucune chaîne
   fournie par l'utilisateur n'est injectée en HTML.
   Dépend de : model.js
   ========================================================================== */

(function (WM) {
  'use strict';

  var M = WM.model;

  /* ---------- Petits utilitaires DOM ---------- */

  function el(id) { return document.getElementById(id); }

  /* Crée un élément avec ses classes, son texte et ses attributs. */
  function creer(balise, options) {
    options = options || {};
    var noeud = document.createElement(balise);
    if (options.classe) noeud.className = options.classe;
    if (options.texte !== undefined && options.texte !== null) noeud.textContent = String(options.texte);
    if (options.attrs) {
      Object.keys(options.attrs).forEach(function (cle) {
        if (options.attrs[cle] !== null && options.attrs[cle] !== undefined) {
          noeud.setAttribute(cle, options.attrs[cle]);
        }
      });
    }
    if (options.enfants) options.enfants.forEach(function (e) { if (e) noeud.appendChild(e); });
    return noeud;
  }

  function vider(noeud) { while (noeud.firstChild) noeud.removeChild(noeud.firstChild); }

  /* ---------- Thème ---------- */

  function appliquerTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var bouton = el('btn-theme');
    var icone = el('btn-theme-icone');
    if (icone) icone.textContent = (theme === 'dark') ? '🌙' : '☀️';
    if (bouton) {
      bouton.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      bouton.setAttribute('aria-label', theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
    }
  }

  /* ---------- Notifications ---------- */

  function toast(message, type) {
    var conteneur = el('toasts');
    if (!conteneur) return;
    var noeud = creer('div', { classe: 'toast' + (type ? ' toast--' + type : ''), texte: message });
    conteneur.appendChild(noeud);
    setTimeout(function () {
      if (noeud.parentNode) noeud.parentNode.removeChild(noeud);
    }, type === 'erreur' ? 7000 : 4000);
  }

  /* ---------- Modales ---------- */

  var pileModales = [];      // modales ouvertes, la dernière est active
  var focusPrecedent = null; // élément à re-focaliser à la fermeture

  var SELECTEUR_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
                            'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function elementsFocusables(racine) {
    return Array.prototype.slice.call(racine.querySelectorAll(SELECTEUR_FOCUSABLE))
      .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }

  function ouvrirModale(idModale, idFocusInitial) {
    var modale = el(idModale);
    if (!modale) return;
    if (pileModales.length === 0) {
      focusPrecedent = document.activeElement;
      document.body.style.overflow = 'hidden'; // empêche le défilement de l'arrière-plan
    }
    modale.hidden = false;
    pileModales.push(modale);

    var cible = idFocusInitial ? el(idFocusInitial) : null;
    if (!cible) {
      var focusables = elementsFocusables(modale);
      cible = focusables[0];
    }
    if (cible) cible.focus();
  }

  function fermerModale(idModale) {
    var modale = idModale ? el(idModale) : pileModales[pileModales.length - 1];
    if (!modale) return;
    modale.hidden = true;
    pileModales = pileModales.filter(function (m) { return m !== modale; });
    if (pileModales.length === 0) {
      document.body.style.overflow = '';
      if (focusPrecedent && typeof focusPrecedent.focus === 'function') focusPrecedent.focus();
      focusPrecedent = null;
    }
  }

  function modaleActive() { return pileModales[pileModales.length - 1] || null; }

  /* Navigation clavier : Échap ferme, Tab reste piégé dans la modale. */
  document.addEventListener('keydown', function (evenement) {
    var modale = modaleActive();
    if (!modale) return;

    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      fermerModale();
      return;
    }
    if (evenement.key !== 'Tab') return;

    var focusables = elementsFocusables(modale);
    if (focusables.length === 0) { evenement.preventDefault(); return; }
    var premier = focusables[0];
    var dernier = focusables[focusables.length - 1];

    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault();
      premier.focus();
    } else if (!modale.contains(document.activeElement)) {
      evenement.preventDefault();
      premier.focus();
    }
  });

  /* Fermeture par le fond ou par tout élément portant data-fermer-modale. */
  document.addEventListener('click', function (evenement) {
    var cible = evenement.target.closest('[data-fermer-modale]');
    if (!cible) return;
    var modale = cible.closest('.modale');
    if (modale) fermerModale(modale.id);
  });

  /* Confirmation générique : renvoie une promesse résolue à true/false. */
  function confirmer(message, libelleValider) {
    return new Promise(function (resoudre) {
      var texte = el('texte-confirmation');
      var valider = el('btn-valider-confirmation');
      var annuler = el('btn-annuler-confirmation');
      texte.textContent = message;
      valider.textContent = libelleValider || 'Confirmer';

      function nettoyer(reponse) {
        valider.removeEventListener('click', surValider);
        annuler.removeEventListener('click', surAnnuler);
        el('modale-confirmation').removeEventListener('click', surFond);
        document.removeEventListener('keydown', surEchap, true);
        fermerModale('modale-confirmation');
        resoudre(reponse);
      }
      function surValider() { nettoyer(true); }
      function surAnnuler() { nettoyer(false); }
      function surFond(evenement) { if (evenement.target.hasAttribute('data-fermer-modale')) nettoyer(false); }
      function surEchap(evenement) { if (evenement.key === 'Escape') nettoyer(false); }

      valider.addEventListener('click', surValider);
      annuler.addEventListener('click', surAnnuler);
      el('modale-confirmation').addEventListener('click', surFond);
      document.addEventListener('keydown', surEchap, true);

      ouvrirModale('modale-confirmation', 'btn-annuler-confirmation');
    });
  }

  /* ---------- Remplissage des listes déroulantes ---------- */

  function remplirSelect(select, valeurs, valeurSelectionnee, optionVide) {
    if (!select) return;
    var valeurCourante = valeurSelectionnee !== undefined ? valeurSelectionnee : select.value;
    vider(select);
    if (optionVide) select.appendChild(creer('option', { texte: optionVide, attrs: { value: '' } }));
    valeurs.forEach(function (v) {
      var valeur = (typeof v === 'string') ? v : v.valeur;
      var libelle = (typeof v === 'string') ? v : v.libelle;
      select.appendChild(creer('option', { texte: libelle, attrs: { value: valeur } }));
    });
    select.value = valeurCourante === undefined || valeurCourante === null ? '' : valeurCourante;
  }

  /* ---------- Tableau de bord ---------- */

  function rendreDashboard(stats) {
    el('kpi-nombre').textContent = String(stats.nombre);
    el('kpi-nombre-detail').textContent =
      stats.parStatut['À acheter'] + ' à acheter · ' +
      stats.parStatut['En attente'] + ' en attente · ' +
      stats.parStatut['Acheté'] + ' acheté(s)';
    el('kpi-budget').textContent = stats.budgetTexte;
    el('kpi-depense').textContent = stats.depenseTexte;
    el('kpi-depense-detail').textContent = stats.depenseEstimee
      ? 'Achats sans prix payé saisi : prix estimé utilisé'
      : 'Articles achetés';
    el('kpi-moyenne').textContent = stats.moyenneTexte;

    var conteneur = el('repartition-contenu');
    vider(conteneur);

    if (stats.repartition.length === 0) {
      conteneur.appendChild(creer('p', {
        classe: 'aide',
        texte: 'Aucun montant estimé à répartir pour la sélection courante.'
      }));
      return;
    }

    var plusieursDevises = stats.repartition.length > 1;
    stats.repartition.forEach(function (groupe) {
      if (plusieursDevises) {
        conteneur.appendChild(creer('p', {
          classe: 'repartition__devise',
          texte: 'Devise ' + groupe.devise + ' — total ' + M.formaterMontant(groupe.total, groupe.devise)
        }));
      }
      groupe.lignes.forEach(function (ligne) {
        var entete = creer('div', {
          classe: 'barre-ligne__entete',
          enfants: [
            creer('span', { texte: ligne.nom }),
            creer('span', {
              classe: 'barre-ligne__montant',
              texte: M.formaterMontant(ligne.montant, groupe.devise) +
                     ' (' + Math.round(ligne.pourcentage) + ' %)'
            })
          ]
        });
        var valeur = creer('div', { classe: 'barre-valeur' });
        valeur.style.width = Math.max(2, ligne.pourcentage) + '%';

        var piste = creer('div', {
          classe: 'barre-piste',
          attrs: {
            role: 'img',
            'aria-label': ligne.nom + ' : ' + M.formaterMontant(ligne.montant, groupe.devise) +
                          ', soit ' + Math.round(ligne.pourcentage) + ' pour cent du total'
          },
          enfants: [valeur]
        });

        conteneur.appendChild(creer('div', { classe: 'barre-ligne', enfants: [entete, piste] }));
      });
    });
  }

  /* ---------- Étiquettes ---------- */

  function classePriorite(priorite) {
    if (priorite === 'Haute') return 'etiquette etiquette--haute';
    if (priorite === 'Moyenne') return 'etiquette etiquette--moyenne';
    return 'etiquette etiquette--basse';
  }

  function classeStatut(statut) {
    if (statut === 'Acheté') return 'etiquette etiquette--achete';
    if (statut === 'Abandonné') return 'etiquette etiquette--abandonne';
    if (statut === 'En attente') return 'etiquette etiquette--moyenne';
    return 'etiquette etiquette--accent';
  }

  /* Bouton d'action d'un article : le libellé et l'intention sont explicites
     pour les lecteurs d'écran grâce à aria-label. */
  function boutonAction(libelle, action, item, classe) {
    return creer('button', {
      classe: 'btn btn--petit ' + (classe || ''),
      texte: libelle,
      attrs: {
        type: 'button',
        'data-action': action,
        'data-id': item.id,
        'aria-label': libelle + ' — ' + item.nom
      }
    });
  }

  function pieceImage(item) {
    if (!item.imageUrl) return null;
    var image = creer('img', {
      classe: 'carte__image',
      attrs: {
        src: item.imageUrl,
        alt: '',                      // image décorative : le nom est déjà dans le titre
        loading: 'lazy',
        referrerpolicy: 'no-referrer' // limite les informations transmises au site distant
      }
    });
    /* Une URL d'image cassée ne doit pas laisser un cadre vide. */
    image.addEventListener('error', function () {
      if (image.parentNode) image.parentNode.removeChild(image);
    });
    return image;
  }

  /* ---------- Vue cartes ---------- */

  function rendreCarte(item, nomCategorie) {
    var etiquettes = [
      creer('span', { classe: classePriorite(item.priorite), texte: item.priorite }),
      creer('span', { classe: classeStatut(item.statut), texte: item.statut }),
      creer('span', { classe: 'etiquette', texte: nomCategorie })
    ];
    if (item.occasion) {
      etiquettes.push(creer('span', { classe: 'etiquette', texte: '🎯 ' + item.occasion }));
    }

    /* Titre : lien externe si une URL produit est renseignée. */
    var titreContenu;
    if (item.url) {
      titreContenu = creer('a', {
        texte: item.nom,
        attrs: { href: item.url, target: '_blank', rel: 'noopener noreferrer nofollow' }
      });
    } else {
      titreContenu = document.createTextNode(item.nom);
    }
    var titre = creer('h3', { classe: 'carte__titre' });
    titre.appendChild(titreContenu);

    var prixTexte = (item.statut === 'Acheté' && item.prixPaye !== null)
      ? M.formaterMontant(item.prixPaye, item.devise) + ' payé'
      : M.formaterMontant(item.prixEstime, item.devise);

    var meta = creer('div', { classe: 'carte__meta' });
    if (item.magasin) meta.appendChild(creer('span', { texte: '🛒 ' + item.magasin }));
    if (item.sousCategorie) meta.appendChild(creer('span', { texte: '📂 ' + item.sousCategorie }));
    if (item.variantes) meta.appendChild(creer('span', { texte: '🏷️ ' + item.variantes }));
    if (item.statut === 'Acheté' && item.dateAchat) {
      meta.appendChild(creer('span', { texte: '✅ Acheté le ' + M.formaterDate(item.dateAchat) }));
    } else {
      meta.appendChild(creer('span', { texte: '📅 Ajouté le ' + M.formaterDate(item.dateAjout) }));
    }

    var corps = creer('div', {
      classe: 'carte__corps',
      enfants: [
        creer('div', { classe: 'etiquettes', enfants: etiquettes }),
        titre,
        creer('div', { classe: 'carte__prix', texte: prixTexte }),
        meta,
        item.notes ? creer('p', { classe: 'carte__notes', texte: item.notes }) : null
      ]
    });

    var pied = creer('div', {
      classe: 'carte__pied',
      enfants: [
        boutonAction('Modifier', 'editer', item),
        boutonAction(item.statut === 'Acheté' ? 'Rouvrir' : 'Acheté', 'basculer-achat', item),
        boutonAction('Supprimer', 'supprimer', item, 'btn--danger')
      ]
    });

    return creer('article', {
      classe: 'carte' + (item.statut === 'Abandonné' ? ' carte--abandonne' : ''),
      enfants: [pieceImage(item), corps, pied]
    });
  }

  /* ---------- Vue liste ---------- */

  function rendreTableau(items, nomsCategories) {
    var entetes = ['Article', 'Catégorie', 'Prix', 'Priorité', 'Statut', 'Occasion', 'Ajouté le', 'Actions'];
    var thead = creer('thead', {
      enfants: [creer('tr', {
        enfants: entetes.map(function (t) {
          return creer('th', { texte: t, attrs: { scope: 'col' } });
        })
      })]
    });

    var tbody = creer('tbody');
    items.forEach(function (item) {
      var cellNom = creer('td', { classe: 'cellule-nom' });
      if (item.url) {
        var lien = creer('a', {
          texte: item.nom,
          attrs: { href: item.url, target: '_blank', rel: 'noopener noreferrer nofollow' }
        });
        var fort = creer('strong');
        fort.appendChild(lien);
        cellNom.appendChild(fort);
      } else {
        cellNom.appendChild(creer('strong', { texte: item.nom }));
      }
      var details = [item.magasin, item.variantes].filter(Boolean).join(' · ');
      if (details) cellNom.appendChild(creer('small', { texte: details }));

      var prixTexte = (item.statut === 'Acheté' && item.prixPaye !== null)
        ? M.formaterMontant(item.prixPaye, item.devise) + ' payé'
        : M.formaterMontant(item.prixEstime, item.devise);

      var actions = creer('td', {
        classe: 'cellule-actions',
        enfants: [
          boutonAction('Modifier', 'editer', item),
          boutonAction(item.statut === 'Acheté' ? 'Rouvrir' : 'Acheté', 'basculer-achat', item),
          boutonAction('Suppr.', 'supprimer', item, 'btn--danger')
        ]
      });

      tbody.appendChild(creer('tr', {
        classe: item.statut === 'Abandonné' ? 'ligne--abandonne' : '',
        enfants: [
          cellNom,
          creer('td', { texte: nomsCategories[item.categorieId] || '—' }),
          creer('td', { texte: prixTexte }),
          creer('td', { enfants: [creer('span', { classe: classePriorite(item.priorite), texte: item.priorite })] }),
          creer('td', { enfants: [creer('span', { classe: classeStatut(item.statut), texte: item.statut })] }),
          creer('td', { texte: item.occasion || '—' }),
          creer('td', { texte: M.formaterDate(item.dateAjout) }),
          actions
        ]
      }));
    });

    return creer('div', {
      classe: 'table-enveloppe',
      enfants: [creer('table', { classe: 'table', enfants: [thead, tbody] })]
    });
  }

  /* ---------- Rendu principal des articles ---------- */

  function rendreArticles(items, vue, categories, aucunArticleDansLaListe) {
    var zone = el('zone-articles');
    vider(zone);

    if (items.length === 0) {
      var titre = aucunArticleDansLaListe ? 'Cette wishlist est vide' : 'Aucun résultat';
      var texte = aucunArticleDansLaListe
        ? 'Ajoutez votre premier article avec le bouton « + Nouvel article ».'
        : 'Aucun article ne correspond à la recherche et aux filtres actifs.';
      zone.appendChild(creer('div', {
        classe: 'vide',
        enfants: [creer('h3', { texte: titre }), creer('p', { texte: texte })]
      }));
      return;
    }

    var nomsCategories = {};
    categories.forEach(function (c) { nomsCategories[c.id] = c.nom; });

    if (vue === 'list') {
      zone.appendChild(rendreTableau(items, nomsCategories));
    } else {
      var grille = creer('div', { classe: 'grille-cartes' });
      items.forEach(function (item) {
        grille.appendChild(rendreCarte(item, nomsCategories[item.categorieId] || '—'));
      });
      zone.appendChild(grille);
    }
  }

  /* ---------- Listes de gestion (wishlists et catégories) ---------- */

  /* Construit une ligne éditable : champ de renommage + bouton de suppression. */
  function rendreLigneGestion(entite, compteur, actionRenommer, actionSupprimer, suppressionPossible) {
    var champ = creer('input', {
      classe: 'input',
      attrs: {
        type: 'text',
        value: entite.nom,
        maxlength: '60',
        'data-action': actionRenommer,
        'data-id': entite.id,
        'aria-label': 'Renommer « ' + entite.nom + ' »'
      }
    });
    var enfants = [champ];
    if (compteur !== null && compteur !== undefined) {
      enfants.push(creer('span', { classe: 'compteur', texte: compteur + ' article' + (compteur > 1 ? 's' : '') }));
    }
    enfants.push(creer('button', {
      classe: 'btn btn--petit btn--danger',
      texte: 'Supprimer',
      attrs: {
        type: 'button',
        'data-action': actionSupprimer,
        'data-id': entite.id,
        'aria-label': 'Supprimer « ' + entite.nom + ' »',
        disabled: suppressionPossible ? null : 'disabled',
        title: suppressionPossible ? null : 'Impossible de supprimer le dernier élément.'
      }
    }));
    return creer('li', { enfants: enfants });
  }

  WM.ui = {
    el: el,
    creer: creer,
    vider: vider,
    appliquerTheme: appliquerTheme,
    toast: toast,
    ouvrirModale: ouvrirModale,
    fermerModale: fermerModale,
    confirmer: confirmer,
    remplirSelect: remplirSelect,
    rendreDashboard: rendreDashboard,
    rendreArticles: rendreArticles,
    rendreLigneGestion: rendreLigneGestion
  };
})(window.WM);
