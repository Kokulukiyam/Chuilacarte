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

## Tests manuels rapides
`scripts/test-server.sh 3400` puis ouvrir http://localhost:3400. Sites de test présents en local (non versionnés) : controle-*, test-donnees-*, ui-collecte.
