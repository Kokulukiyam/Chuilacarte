# État d'avancement (mis à jour à chaque étape)

Branche : `claude/chuilacarte`. Avancement global : ~90 %. Dépôt distant : https://github.com/Kokulukiyam/Chuilacarte (branche `claude/chuilacarte`, poussée après chaque commit).

## Fait
- Étapes 1 à 8 de SPEC.md implémentées et commitées (socle, sources + collecte, couches/styles/édition, annotations/mesures, mise en page + exports, pont QGIS, analyses, implantation 3D/ombres). README rédigé.
- `SOURCES.md` produit par l'agent de vérification des sources.
- Contrôle QGIS (agent) : 3 passages, plus que des défauts mineurs → `exemples/CONTROLE_QGIS.md`.
- Contrôle des données (agent) : 2 passages, plus que des défauts mineurs (zone tampon des anciens sites régénérée à l'ouverture depuis).
- Contrôle cartographique (agent) → `exemples/CONTROLE_CARTOGRAPHIQUE.md` (19 défauts). Corrigés : PNG par bandes + un export à la fois, échelle exacte ellipsoïdale (N-S 0,6 % corrigé), légende auto-ajustée (plus de message rouge imprimé), cartouche (largeur des libellés, champs MOA/phase/planche), attributions dédoublonnées (sources dans le cartouche, pas en double), étiquettes du fond au-dessus des couches (écran et export), fond « Papier + noms de rues » par défaut dans les mises en page, facteur d'épaisseurs/symboles par format, occupation du sol catégorisée (+ aéroport), courbes lissées et cotées, sous-titre selon l'échelle, nom de planche suivant le format, bâti OSM masqué par défaut (Google affiché).

## Reste à faire
1. (en cours) 2e passage de l'agent cartographique sur des sites neufs `exemple-*` → exports définitifs dans `exemples/medina|yoff|fatick/`.
2. (en cours) Étape 9 : agent de test de bout en bout Playwright (créer un site par recherche/dessin/import, collecter, styler, annoter, mesurer, chaque analyse, importer et caler `tests/fixtures/projet_local.dxf`, 3D, ombres, mise en page + exports PNG/PDF/SVG/GeoJSON/GPKG/DXF, export QGIS ; zéro erreur console ; supprimer ses données). Corriger jusqu'à ce que tout passe.
3. Étape 10 : compléter `RAPPORT.md` (fait / non fait / limites) et relire le README.

## Défauts connus non traités (mineurs)
- Points d'équipements proches qui se superposent ; peu de noms d'équipements sur les cartes.
- Le fond vectoriel est rastérisé dans les PDF/SVG (choisir le fond « Papier » pour un export 100 % vectoriel).
- PDF : polices en Identity-H (avertissement poppler sans conséquence).
- Import d'un GeoPackage exporté : les tables séparées par type de géométrie reviennent en plusieurs couches.

## Session locale (04/11/2026, Mac)
- Build de production réparé en local : configuration ESLint d'un dossier parent ignorée, racine du projet fixée, `scripts/test-server.sh` compatible macOS (`lsof`).
- Playwright 1.64.1 ajouté en devDependency (script de bout en bout : `tests/e2e/bout-en-bout.ts`).
- Relancés : l'agent de bout en bout (serveur 3500) et l'agent cartographique, 2e passage (serveur 3600, sites `exemple-medina|yoff|fatick`).

## Tests manuels rapides
`scripts/test-server.sh 3400` puis ouvrir http://localhost:3400. Sites de test présents en local (non versionnés) : controle-*, test-donnees-*, ui-collecte.

## Comment reprendre (Claude Code, en local)
1. `git clone https://github.com/Kokulukiyam/Chuilacarte && cd Chuilacarte && git checkout claude/chuilacarte && npm install`.
2. Les sites de test (`data/sites/`) ne sont pas versionnés : en recréer via l'interface (voir README § 4) pour tester.
3. Les agents de contrôle cartographique (2e passage) et de bout en bout étaient en cours à la fin de la session cloud ; leurs rapports n'ont peut-être pas été écrits. À refaire :
   - test de bout en bout : suivre le scénario « Agent de test de bout en bout » de SPEC.md avec Playwright sur `scripts/test-server.sh 3500`, écrire `exemples/CONTROLE_BOUT_EN_BOUT.md`, corriger chaque défaut ;
   - contrôle cartographique : créer 3 sites neufs (Médina îlot [[-17.4475,14.6745],[-17.4445,14.6770]] tampon 300 m ; Yoff [[-17.4880,14.7480],[-17.4780,14.7560]] 300 m ; Fatick [[-16.4180,14.3330],[-16.4060,14.3420]] 500 m), collecter, nouvelle mise en page, exporter PNG/PDF/SVG dans `exemples/medina|yoff|fatick/`, regarder les images, compléter `exemples/CONTROLE_CARTOGRAPHIQUE.md`.
4. Puis compléter `RAPPORT.md` (sections « fait / non fait / limites ») et mettre à jour ce fichier.
5. Toujours : `npx tsc --noEmit` et `npm test` verts avant chaque commit ; commit + push après chaque étape.
