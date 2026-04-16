# Empire Hussein — Contexte projet pour Claude

## Présentation

Site gouvernemental fictif de l'**Empire Hussein**, monarchie théocratique absolue dirigée par la famille Hussein.
Le site est hébergé sur **GitHub Pages** (site statique pur : HTML / CSS / JS vanilla, aucun framework).

**Repo GitHub :** https://github.com/BJBellum/Empire-Hussein
**URL du site :** https://bjbellum.github.io/Empire-Hussein/


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

## Accessibilité — Règles d'usage des couleurs

- **`--text-muted`** (`#9A8B7A`) est le niveau minimum pour du texte lisible — métadonnées uniquement.
- **`--gold-dark`** (`#8B6914`) est réservé aux bordures et éléments décoratifs — pas de texte sur fond sombre. Pour du texte doré, utiliser `--gold`.
- Ne jamais introduire une nouvelle couleur de texte sans vérifier son ratio de contraste sur `--bg-deep`, `--bg-section`, `--bg-card`.

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

Toute nouvelle page HTML doit recevoir ce script dans le `<head>` (sauf `index.html`, servi comme `/` par GitHub Pages).
