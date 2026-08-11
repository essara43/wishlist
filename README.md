# 🎁 Wishlist Manager

Gestionnaire de listes d'envies **100 % local** : HTML, CSS et JavaScript vanilla,
sans framework, sans build, sans dépendance externe. Vos données restent dans le
`localStorage` de votre navigateur et ne sont **jamais** envoyées vers un serveur.

Thème sombre par défaut, thème clair au choix, utilisable sur mobile comme sur desktop.

---

## Sommaire

- [Installation](#installation)
- [Utilisation](#utilisation)
- [Structure des fichiers](#structure-des-fichiers)
- [Modèle de données](#modèle-de-données)
- [Publier sur GitHub Pages](#publier-sur-github-pages)
- [Vie privée et limites connues](#vie-privée-et-limites-connues)

---

## Installation

Aucune. Il n'y a rien à compiler ni à installer.

**Option 1 — ouverture directe (la plus simple)**

```bash
git clone https://github.com/essara43/wishlist.git
cd wishlist
```

Puis double-cliquez sur `index.html`, ou ouvrez-le depuis votre navigateur
(`Fichier ▸ Ouvrir…`). L'application fonctionne telle quelle en `file://`,
y compris le stockage local.

**Option 2 — petit serveur local** (utile pour tester le comportement réel d'un
site publié, par exemple les URL relatives ou le cache) :

```bash
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

> Chaque origine possède son propre stockage : les données saisies en `file://`
> ne sont pas visibles depuis `http://localhost:8000`, ni depuis la version
> publiée sur GitHub Pages. Utilisez l'export/import JSON pour les transférer.

### Navigateurs supportés

Chrome, Edge, Firefox et Safari récents (desktop et mobile). Le code n'utilise
que des API natives largement disponibles : `localStorage`, `Intl`, `FileReader`,
`Blob` et `Promise`.

---

## Utilisation

### Premier lancement

Un jeu de **données de démonstration** est chargé automatiquement (3 wishlists,
16 articles). Vous pouvez l'effacer en un clic : **Données ▸ Effacer les données
de démo**. Vos propres articles ne sont jamais touchés par cette action.

### Articles

- **+ Nouvel article** ouvre le formulaire en modale. Seul le nom est obligatoire ;
  le prix doit être un nombre positif (la virgule décimale est acceptée) et les URL
  doivent commencer par `http://` ou `https://`.
- Chaque carte propose **Modifier**, **Acheté** (bascule rapide, qui date l'achat
  du jour) et **Supprimer** (avec confirmation).
- Passer un article au statut *Acheté* fait apparaître les champs **date d'achat**
  et **prix réellement payé**.

### Recherche, filtres et tri

| Outil | Portée |
|---|---|
| Recherche | nom, magasin, notes, variantes, sous-catégorie, occasion — accents ignorés |
| Filtres | catégorie, statut, priorité, occasion, prix min./max. — tous combinables |
| Tri | date d'ajout, prix croissant/décroissant, priorité, nom A→Z |
| Vue | cartes (avec image optionnelle) ou liste tabulaire |

Une pastille sur « Filtres » indique le nombre de filtres actifs, et le bouton
**Réinitialiser les filtres** remet tout à zéro.

### Wishlists multiples

**Listes** permet de créer, renommer et supprimer des wishlists, avec le nombre
d'articles de chacune. Le sélecteur en haut à droite bascule de l'une à l'autre.
Supprimer une wishlist supprime aussi ses articles, après confirmation.

### Catégories

**Catégories** permet d'ajouter, renommer et supprimer des catégories. Les neuf
catégories par défaut sont : Mode & accessoires, Beauté, Maison & déco,
Tech & informatique, Sport & fitness, Livres & formation, Voyage, Art & créatif, Autre.

> Supprimer une catégorie ne supprime aucun article : ceux qui l'utilisaient sont
> reclassés dans « Autre », recréée automatiquement si nécessaire.

### Tableau de bord

Quatre indicateurs, calculés sur **la liste active avec les filtres appliqués** :

| Indicateur | Définition |
|---|---|
| Articles affichés | Nombre d'articles visibles, avec la répartition par statut |
| Budget estimé restant | Somme des prix estimés des statuts *À acheter* et *En attente* |
| Déjà dépensé | Somme des articles *Acheté* : prix payé, ou prix estimé s'il n'est pas renseigné |
| Panier moyen estimé | Budget restant divisé par le nombre d'articles concernés |

En dessous, la **répartition du montant estimé par catégorie** est représentée par
des barres CSS (aucune librairie de graphiques).

Les articles *Abandonné* sont exclus de tous les totaux.

**Les devises ne sont jamais converties.** Aucun taux de change n'étant disponible
hors ligne, un total mêlant plusieurs devises est affiché devise par devise
(`1 200,00 AED · 2 105,90 €`) plutôt qu'agrégé avec un taux inventé.

### Import / export

Dans **Données** :

- **Export JSON (tout)** — sauvegarde complète : wishlists, articles, catégories,
  réglages. C'est le format à utiliser pour une sauvegarde ou un transfert entre
  navigateurs.
- **Export CSV (liste courante)** — la liste active telle qu'elle est filtrée et
  triée à l'écran. Séparateur `;` et BOM UTF-8, pour un double-clic direct dans
  Excel ou LibreOffice francophones.
- **Import JSON** — au choix :
  - *Fusionner* : les articles du fichier s'ajoutent aux vôtres (nouveaux
    identifiants, catégories et listes appariées par nom) ;
  - *Remplacer* : les données actuelles sont écrasées.

  Dans les deux cas, une confirmation est demandée et un fichier invalide est
  refusé avec un message explicite.
- **Réinitialiser toutes les données** — efface tout et repart d'une installation
  vierge. Pensez à exporter d'abord.

### Accessibilité

Tous les champs ont un `label`, les modales sont des `dialog` avec piège de focus
(`Tab` / `Maj+Tab` y restent, `Échap` ferme, le focus revient à l'élément
déclencheur), un lien d'évitement mène au contenu principal, les barres du
tableau de bord ont une description textuelle et les contrastes visent le
niveau AA dans les deux thèmes.

---

## Structure des fichiers

```
wishlist/
├── index.html          Structure de la page et modales
├── css/
│   └── style.css       Jetons de thème, layout responsive, composants
├── js/
│   ├── model.js        Constantes, fabriques, validation, formatage
│   ├── store.js        localStorage, migration, données de démo
│   ├── filters.js      Recherche, filtres, tri, calculs du tableau de bord
│   ├── io.js           Export JSON/CSV, lecture et fusion d'un import
│   ├── ui.js           Rendu DOM, modales, notifications, thème
│   └── app.js          État, câblage des événements, orchestration
├── .nojekyll           Désactive le traitement Jekyll sur GitHub Pages
├── .gitignore
└── README.md
```

Les fichiers JS sont chargés comme **scripts classiques** (et non comme modules
ES) et communiquent via un espace de noms global unique, `window.WM`. C'est ce
qui permet d'ouvrir `index.html` par un simple double-clic : les modules ES sont
bloqués par la politique CORS sur le protocole `file://`.

Ordre de chargement (chaque fichier ne dépend que des précédents) :

```
model.js → store.js → filters.js → io.js → ui.js → app.js
```

---

## Modèle de données

Tout est stocké sous une clé unique et **versionnée** : `wishlist_data_v1`.
Une évolution future du schéma utilisera `VERSION_SCHEMA = 2` et une étape de
conversion dans `store.migrer()`, prévue à cet effet.

```jsonc
{
  "version": 1,
  "updatedAt": "2026-08-11T09:20:00.000Z",
  "settings": {
    "theme": "dark",              // "dark" | "light"
    "view": "cards",              // "cards" | "list"
    "defaultCurrency": "EUR",     // devise proposée par défaut au formulaire
    "activeListId": "lst_abc123",
    "demoLoaded": true
  },
  "categories": [
    { "id": "cat_abc123", "nom": "Maison & déco" }
  ],
  "lists": [
    { "id": "lst_abc123", "nom": "Appartement",
      "createdAt": "2026-08-11T09:20:00.000Z", "demo": false }
  ],
  "items": [
    {
      "id": "itm_abc123",
      "listId": "lst_abc123",
      "nom": "Lampadaire arc laiton",
      "categorieId": "cat_abc123",
      "sousCategorie": "Éclairage",     // optionnel
      "prixEstime": 189.9,              // nombre ≥ 0, ou null
      "devise": "EUR",                  // EUR | AED | USD | GBP
      "magasin": "La Redoute Intérieurs",
      "url": "https://exemple.fr/produit",   // http(s) uniquement, ou ""
      "imageUrl": "",                        // http(s) uniquement, ou ""
      "priorite": "Moyenne",            // Haute | Moyenne | Basse
      "statut": "À acheter",            // À acheter | En attente | Acheté | Abandonné
      "dateAjout": "2026-07-23T10:00:00.000Z",
      "dateAchat": null,                // ISO si statut = Acheté, sinon null
      "prixPaye": null,                 // nombre ≥ 0 si statut = Acheté, sinon null
      "variantes": "Finition laiton",   // taille / couleur / référence, optionnel
      "occasion": "Déménagement",       // champ libre, optionnel
      "notes": "Vérifier la hauteur sous plafond.",
      "demo": false                     // true = effaçable via « Effacer la démo »
    }
  ]
}
```

Points de conception :

- Les catégories sont référencées par **identifiant**, jamais par nom : les
  renommer ne casse aucun article.
- À la lecture, `store.migrer()` **répare** plutôt qu'il ne rejette : champ
  manquant complété, type incohérent corrigé, article orphelin rattaché à la
  première liste et à la catégorie « Autre ». Un contenu totalement illisible
  est conservé sous une clé `wishlist_data_v1_corrompu_<horodatage>` avant que
  l'application ne reparte d'une structure saine.
- Les URL ne sont acceptées qu'en `http:`/`https:`, y compris à l'import — un
  `javascript:` glissé dans un fichier JSON est neutralisé. Le DOM est construit
  par `createElement`/`textContent`, jamais par concaténation de HTML.

---

## Publier sur GitHub Pages

Le dépôt est déjà à la racine du site : il n'y a rien à adapter.

1. **Poussez le code** sur GitHub (branche `main`, par exemple) :

   ```bash
   git add .
   git commit -m "Wishlist Manager"
   git push -u origin main
   ```

2. Sur GitHub, ouvrez le dépôt puis **Settings ▸ Pages**.

3. Sous **Build and deployment** :
   - *Source* : **Deploy from a branch**
   - *Branch* : `main` — dossier `/ (root)`
   - **Save**

4. Patientez une à deux minutes. L'URL apparaît en haut de la même page :

   ```
   https://<votre-compte>.github.io/wishlist/
   ```

5. Vérifiez que le site s'affiche. En cas de page blanche, ouvrez la console du
   navigateur : une erreur 404 sur `css/style.css` ou `js/app.js` signale que les
   fichiers n'ont pas été poussés à la racine du dépôt.

Quelques précisions utiles :

- Le fichier `.nojekyll` évite que GitHub ne fasse passer le site par Jekyll,
  qui ignore les dossiers commençant par `_`. Il ne coûte rien et évite une
  mauvaise surprise si vous ajoutez plus tard un dossier de ce type.
- Chaque `git push` sur la branche publiée redéploie le site automatiquement.
- Un site GitHub Pages est **public**, même dans un dépôt privé sur les offres
  payantes. N'y saisissez pas de données sensibles : elles resteront dans votre
  navigateur, mais l'URL, elle, est accessible à qui la connaît.
- Les données d'un visiteur lui sont propres : rien n'est partagé entre
  utilisateurs, puisqu'il n'y a pas de serveur.

---

## Vie privée et limites connues

**Aucune donnée n'est transmise.** L'application ne contient ni appel réseau, ni
traceur, ni police ou script distant. Deux nuances honnêtes :

- Si vous renseignez une **URL d'image**, votre navigateur va évidemment la
  chercher sur le site concerné, qui verra passer votre adresse IP. Les images
  sont chargées avec `referrerpolicy="no-referrer"` pour limiter ce qui est
  transmis, et les liens produits avec `rel="noopener noreferrer nofollow"`.
- Les données vivent dans le `localStorage` du navigateur : vider les données de
  navigation, changer de navigateur ou passer en navigation privée les fait
  disparaître. **Exportez régulièrement en JSON.**

Autres limites assumées :

- Pas de conversion entre devises (voir plus haut).
- La fourchette de prix des filtres s'applique à la valeur numérique sans
  distinction de devise.
- Le quota de `localStorage` est d'environ 5 Mo. En cas de dépassement,
  l'enregistrement échoue proprement : un message vous invite à exporter vos
  données, et la modification reste visible à l'écran le temps de la session.
- L'import CSV n'est pas géré, seulement l'export. Le format d'échange complet
  est le JSON.

---

## Licence

Projet personnel, réutilisable librement.
