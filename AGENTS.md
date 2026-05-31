# Empire Hussein - Guide projet pour assistants IA

Ce fichier sert de contexte commun pour Codex, Claude et les autres assistants IA qui modifient ce dépôt.

## Architecture

- Site statique GitHub Pages : HTML, CSS et JavaScript vanilla uniquement.
- Aucun backend, framework, gestionnaire de paquets ou build step.
- Accueil : `index.html`.
- Pages publiques : `pages/`.
- Tableau de bord admin : `pages/dashboard.html`, `js/dashboard.js`, `js/dashboard-map.js`.
- Carte SVG : `js/map-engine.js`, `js/map-modes.js`, `js/map.js`.
- Données versionnées : `data/`.
- Ressources : `assets/` et `fonts/`.

## Commande locale

Depuis la racine du dépôt :

```sh
python3 -m http.server 4173
```

Ouvrir ensuite `http://localhost:4173/`.

## Contraintes de conception

- Conserver le thème sombre, doré et cinématique existant.
- Utiliser `Dune Rise` pour les titres, labels de navigation et badges.
- Ne pas mettre d'accents dans les textes affichés avec `Dune Rise`.
- Utiliser `Nunito` pour le texte courant et conserver les accents français.
- Réutiliser les variables de `css/style.css` avant d'ajouter une couleur.
- Garder `--text-muted` comme niveau minimum pour le texte secondaire lisible.

## Contraintes techniques

- Ne pas introduire de dépendance ou d'étape de compilation sans demande explicite.
- Les liens internes vers une page HTML doivent garder l'extension `.html`.
- Les pages secondaires retirent seulement l'extension visible avec le script `history.replaceState` placé dans le `<head>`.
- Respecter `prefers-reduced-motion`.
- Préserver le fallback visuel de la vidéo d'accueil.
- Ne jamais versionner de token Discord ou GitHub.

## Performance et mémoire

- La vidéo `assets/bg.mp4` est volontairement déchargée lorsque le héros quitte l'écran ou que l'onglet devient invisible. Ne pas la transformer en média actif permanent.
- La carte publique est volontairement chargée seulement à l'approche de la section territoires. Ne pas rétablir un chargement immédiat au démarrage.
- Toute reconstruction de carte doit appeler `MapEngine.build(...).destroy()` sur l'instance précédente.
- La cartographie du tableau de bord est libérée lorsque son panneau est masqué afin de relâcher le GeoJSON et les chemins SVG.
- Les drapeaux de transit doivent rester dans `assets/drapeaux/`. Dans les fichiers `data/canal-suez.json` et `data/detroit-gibraltar.json`, stocker un chemin de fichier, jamais une URL `data:image/...;base64`.
- Charger les images non critiques avec `loading="lazy"`.
- Éviter de dupliquer un gros objet JSON dans `localStorage` si une référence de fichier suffit.

## Authentification

- `js/auth.js` utilise OAuth2 Discord implicit grant, adapté au site statique.
- Le token Discord est stocké localement avec expiration.
- Le tableau de bord et les forces armées sont réservés aux IDs admin déclarés dans `js/auth.js`.
- La configuration GitHub saisie dans le dashboard reste locale au navigateur.

## Vérifications minimales

Après une modification JavaScript ou JSON :

```sh
node --check js/main.js
node --check js/map-engine.js
node --check js/map.js
node --check js/dashboard-map.js
jq empty data/*.json
```

Vérifier manuellement l'accueil, la carte territoires, les pages Suez et Gibraltar, puis le panneau cartographie du dashboard si l'accès admin est disponible.

## Documentation complémentaire

`CLAUDE.md` contient un contexte historique plus détaillé, notamment les règles d'URL propres et la palette.
