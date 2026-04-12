# Empire Hussein — Contexte projet pour Claude

## Présentation

Site gouvernemental fictif de l'**Empire Hussein**, monarchie théocratique absolue dirigée par la famille Hussein.
Le site est hébergé sur **GitHub Pages** (site statique pur : HTML / CSS / JS vanilla, aucun framework).

**Repo GitHub :** https://github.com/BJBellum/Empire-Hussein
**URL du site :** https://bjbellum.github.io/Empire-Hussein/

---

## Structure des fichiers

```
Empire-Hussein/
├── index.html              ← Page principale (hero + sections)
├── economie.html           ← Placeholder — à construire
├── catalogues.html         ← Placeholder — à construire
├── energie.html            ← Placeholder — à construire
├── forces-armees.html      ← Placeholder — accès admin uniquement
├── .nojekyll               ← Requis pour GitHub Pages (pas de Jekyll)
├── css/style.css           ← Feuille de styles principale
├── js/auth.js              ← Authentification Discord OAuth2
├── js/main.js              ← Animations, scroll, effets
├── assets/
│   ├── bg.mp4              ← Vidéo de fond (dunes du Sahara, Mixkit)
│   ├── poster.jpg          ← Fallback poster pour la vidéo
│   └── Hussein Empire Coat of Arms.png  ← Favicon / blason de l'Empire
└── fonts/
    ├── Dune_Rise.otf/.ttf  ← Police pour les titres (sans accents)
    └── Nunito/
        ├── Nunito-VariableFont_wght.ttf
        └── Nunito-Italic-VariableFont_wght.ttf
```

---

## Règles de design

### Polices
- **Dune Rise** → tous les titres, labels de navigation, badges (`font-family: var(--font-display)`)
  - **Jamais d'accents** sur les éléments en Dune Rise (écrire ARMEE pas ARMÉE, PROPHETE pas PROPHÈTE)
- **Nunito** → tout le texte courant, descriptions, paragraphes (`font-family: var(--font-body)`)
  - Les accents français sont **obligatoires** sur le texte Nunito

### Palette de couleurs (variables CSS)
- `--gold` : `#C9A84C` — couleur principale, accents dorés
- `--gold-light` : `#E4CC7A`
- `--gold-dark` : `#8B6914`
- `--bg-deep` : `#060606` — fond principal
- `--bg-section` : `#0A0A0A`
- `--bg-card` : `#111111`
- `--text-primary` : `#F5F0E8`
- `--text-secondary` : `#C0B2A0`
- `--text-muted` : `#9A8B7A`

### Conventions visuelles
- Thème : cinématique, désert, Dune — sombre, doré, dramatique
- Boutons de navigation : texte en Dune Rise, soulignement doré animé au hover
- Sections : animations de révélation au scroll (Intersection Observer)
- Header : glassmorphism qui s'active au scroll

---

## Authentification Discord

Fichier : `js/auth.js`

- Flux OAuth2 **implicit grant** (compatible site statique, pas de backend)
- L'utilisateur se connecte via le bouton Discord dans le header
- **IDs admin autorisés** (donnent accès à Forces Armées) :
  - `772821169664426025`
  - `950389750739664896`
- Le token est stocké dans `localStorage` (expire après 7 jours)
- **À configurer** : remplacer `'YOUR_CLIENT_ID_HERE'` dans `js/auth.js` par le Client ID de l'application Discord

---

## Navigation

| Bouton | Comportement |
|---|---|
| L'EMPIRE | Scroll vers la section `#empire` sur index.html |
| PROPHETE | Scroll vers la section `#prophete` sur index.html |
| ECONOMIE | Lien vers `economie.html` (à construire) |
| CATALOGUES | Lien vers `catalogues.html` (à construire) |
| ENERGIE | Lien vers `energie.html` (à construire) |
| FORCES ARMEES | Lien vers `forces-armees.html` — verrouillé si non-admin |

---

## Pages à construire

Les pages suivantes sont des placeholders et doivent être développées :
- `economie.html`
- `catalogues.html`
- `energie.html`
- `forces-armees.html` (accessible uniquement aux admins Discord)

Respecter le même design system que `index.html` : variables CSS, polices, animations reveal-up, header identique.

---

## Accessibilité — Contraste des couleurs

### Ratios de contraste (WCAG AA : 4.5:1 texte normal, 3:1 grand texte)

| Variable | Valeur | Ratio sur `--bg-deep` | Ratio sur `--bg-card` | Statut |
|---|---|---|---|---|
| `--text-primary` | `#F5F0E8` | ~18:1 | ~16:1 | ✅ AAA |
| `--text-secondary` | `#C0B2A0` | ~10.0:1 | ~9.4:1 | ✅ AAA |
| `--text-muted` | `#9A8B7A` | ~6.3:1 | ~5.9:1 | ✅ AA |
| `--gold` | `#C9A84C` | ~8.6:1 | ~8.0:1 | ✅ AA |
| `--gold-dark` | `#8B6914` | ~4.1:1 | ~3.8:1 | ⚠️ Décoratif uniquement |

### Hiérarchie visuelle des niveaux de texte

Les trois niveaux de texte doivent rester **visuellement distincts** les uns des autres. Ne jamais les rapprocher au point qu'ils se confondent à l'œil :

| Niveau | Variable | Ratio | Écart minimal avec le niveau suivant |
|---|---|---|---|
| Principal | `--text-primary` #F5F0E8 | ~18:1 | ≥ 5 pts de ratio |
| Secondaire | `--text-secondary` #C0B2A0 | ~10:1 | ≥ 3 pts de ratio |
| Atténué | `--text-muted` #9A8B7A | ~6.3:1 | — |

### Règles d'usage

- **`--text-muted`** est le niveau minimum pour du texte lisible — utiliser uniquement pour les métadonnées (dates, labels, hints). Ne jamais aller plus bas.
- **`--gold-dark`** (`#8B6914`) ne doit **pas** être utilisé comme couleur de texte sur fond sombre — il est réservé aux **bordures, icônes décoratifs et éléments visuels**. Pour du texte en doré, utiliser `--gold` à la place.
- **`--gold-dark` comme texte** : si un cas spécifique l'exige (ex: badge, hash de commit), compenser avec un fond clair ou utiliser directement `--gold`.
- `#ffffff` (blanc pur) est acceptable pour les compteurs et indicateurs techniques (ex: compteur de caractères de l'éditeur).
- Ne jamais introduire une nouvelle couleur de texte sans vérifier son ratio de contraste avec les fonds possibles (`--bg-deep`, `--bg-section`, `--bg-card`).

---

## Contraintes techniques

- **Site statique GitHub Pages** — pas de backend, pas de Node.js, pas de build step
- Pas de frameworks JS (pas de React, Vue, etc.) — vanilla JS uniquement
- Optimisé pour la performance : `requestAnimationFrame` pour le scroll, `IntersectionObserver` pour les révélations, `font-display: swap`, `prefers-reduced-motion` respecté
- La vidéo de fond a un fallback CSS gradient si elle ne charge pas

---

## Convention URLs propres (sans `.html`)

GitHub Pages sert les fichiers `.html` uniquement via leur chemin complet (ex: `dashboard.html`). Pour afficher des URLs propres dans la barre d'adresse du navigateur, chaque page utilise un script inline dans le `<head>` qui retire l'extension immédiatement au chargement.

### Règle obligatoire : script à placer dans le `<head>` de chaque page

```html
<!-- Clean URL: retire .html de la barre d'adresse instantanément -->
<script>if(location.pathname.endsWith('.html'))history.replaceState(null,'',location.pathname.replace('.html',''));</script>
```

Ce script doit être **dans le `<head>`**, après les balises `<meta>` et `<link>`, pour s'exécuter avant tout rendu visible.

### Règles de liens internes

- Les liens `href` utilisent **toujours l'extension `.html`** pour que GitHub Pages serve correctement les fichiers.
  - ✅ `href="dashboard.html"` — fonctionne, GitHub Pages trouve le fichier
  - ❌ `href="dashboard"` — GitHub Pages retourne 404 (pas de réécriture serveur)
- Le script retire `.html` de l'URL **affichée** sans rechargement via `history.replaceState`
- **GitHub Pages ne fait pas de réécriture d'URL côté serveur** — ne pas essayer de configurer `.htaccess` ou `_redirects` (non supportés)

### Pages actuellement équipées

| Page | Script dans `<head>` |
|---|---|
| `dashboard.html` | ✅ |
| `index.html` | Non nécessaire (servi comme `/` par GitHub Pages) |
| Autres pages | À ajouter lors de leur construction |
