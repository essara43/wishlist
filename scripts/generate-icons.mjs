/**
 * Génère les icônes PNG de la PWA : un paquet cadeau blanc sur un disque rose
 * pâle, posé sur le rose d'accent — même construction que les icônes du
 * Budget Planner, dont on reprend les trois teintes.
 *
 * Écrit en Node pur avec `zlib`, comme le script équivalent du Goal Planner :
 * pas de dépendance de build pour quatre images. Relancer avec
 *   node scripts/generate-icons.mjs
 * après toute modification de la palette.
 */
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

/* Palette partagée avec le Budget Planner. */
const ACCENT = [255, 133, 179];   // #ff85b3 — fond de l'icône
const PALE = [255, 211, 230];     // #ffd3e6 — disque intermédiaire
const BLANC = [255, 255, 255];    // motif

/* Le rendu est calculé à 3× puis moyenné : c'est notre anticrénelage. */
const SUPERSAMPLE = 3;

/* ---------- Primitives géométriques, en coordonnées normalisées ---------- */

function dansDisque(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Rectangle à coins arrondis. */
function dansRectArrondi(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Couleur d'un point du motif.
 * `echelle` rétrécit le dessin autour du centre : les icônes maskable doivent
 * tenir dans la zone sûre (80 % du canevas), sinon Android en rogne les bords.
 */
function couleurMotif(x, y, echelle) {
  /* On ramène le point dans le repère du motif à taille 1. */
  const mx = (x - 0.5) / echelle + 0.5;
  const my = (y - 0.5) / echelle + 0.5;

  /* Le disque pâle sert aussi de couleur aux rubans « creusés » dans le
     cadeau : le motif ne compte ainsi que trois teintes, comme le cœur du
     Budget Planner. */
  const surDisque = dansDisque(mx, my, 0.5, 0.5, 0.365);
  const fond = surDisque ? PALE : ACCENT;

  const nœudGauche = dansDisque(mx, my, 0.425, 0.287, 0.077);
  const nœudDroit = dansDisque(mx, my, 0.575, 0.287, 0.077);
  const couvercle = dansRectArrondi(mx, my, 0.255, 0.335, 0.745, 0.425, 0.022);
  const boite = dansRectArrondi(mx, my, 0.295, 0.425, 0.705, 0.715, 0.022);

  if (!(nœudGauche || nœudDroit || couvercle || boite)) return fond;

  /* Rubans : on retire de la matière au lieu d'ajouter une quatrième couleur. */
  const rubanVertical = mx >= 0.477 && mx <= 0.523 && my >= 0.335;
  const rubanHorizontal = my >= 0.417 && my <= 0.433;
  if (rubanVertical || rubanHorizontal) return fond;

  return BLANC;
}

/* ---------- Rendu ---------- */

/** Retourne un buffer RGBA de `taille`×`taille`. */
function rendre(taille, { pleinBord, echelle }) {
  const pixels = Buffer.alloc(taille * taille * 4);

  for (let py = 0; py < taille; py++) {
    for (let px = 0; px < taille; px++) {
      let r = 0, v = 0, b = 0, a = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / taille;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / taille;

          /* Icône « any » : carré à coins arrondis sur fond transparent.
             Icône « maskable » : le fond doit couvrir tout le canevas. */
          if (!pleinBord && !dansRectArrondi(x, y, 0, 0, 1, 1, 0.22)) continue;

          const c = couleurMotif(x, y, echelle);
          r += c[0]; v += c[1]; b += c[2]; a += 255;
        }
      }

      const n = SUPERSAMPLE * SUPERSAMPLE;
      const i = (py * taille + px) * 4;
      /* Les composantes sont prémultipliées par la couverture, donc
         redivisées par le nombre d'échantillons opaques. */
      const opaques = a / 255;
      pixels[i] = opaques ? Math.round(r / opaques) : 0;
      pixels[i + 1] = opaques ? Math.round(v / opaques) : 0;
      pixels[i + 2] = opaques ? Math.round(b / opaques) : 0;
      pixels[i + 3] = Math.round(a / n);
    }
  }
  return pixels;
}

/* ---------- Encodage PNG ---------- */

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(corps) >>> 0);
  return Buffer.concat([longueur, corps, controle]);
}

function encoderPng(pixels, taille) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete[8] = 8;    // 8 bits par composante
  entete[9] = 6;    // RVBA
  entete[10] = 0;   // compression standard
  entete[11] = 0;   // filtrage standard
  entete[12] = 0;   // pas d'entrelacement

  /* Chaque ligne est préfixée par son type de filtre (0 = aucun). */
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y++) {
    brut[y * (taille * 4 + 1)] = 0;
    pixels.copy(brut, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- Écriture ---------- */

mkdirSync(OUT_DIR, { recursive: true });

const cibles = [
  { nom: 'icon-192.png', taille: 192, pleinBord: false, echelle: 1 },
  { nom: 'icon-512.png', taille: 512, pleinBord: false, echelle: 1 },
  { nom: 'icon-192-maskable.png', taille: 192, pleinBord: true, echelle: 0.76 },
  { nom: 'icon-512-maskable.png', taille: 512, pleinBord: true, echelle: 0.76 }
];

for (const cible of cibles) {
  const png = encoderPng(rendre(cible.taille, cible), cible.taille);
  writeFileSync(join(OUT_DIR, cible.nom), png);
  console.log(cible.nom + ' — ' + png.length + ' octets');
}
