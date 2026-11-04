# Décisions prises en autonomie

Chaque ligne : un choix non précisé par la spécification, et la raison.

## Socle
- Next.js 15 (App Router) + React 19 + Tailwind 4 : versions stables actuelles ; TypeScript 5 (Next ne gère pas encore TypeScript 7).
- Dessin et édition : **Terra Draw** (+ adaptateur MapLibre officiel), maintenu et compatible MapLibre 5.
- Lecture GeoPackage/Overture : DuckDB 2 (`@duckdb/node-api`) avec les extensions `spatial` et `httpfs` ; `geometry_always_xy = true` imposé globalement pour éviter toute inversion lat/lon.
- Shapefile zippé : `shpjs` (lit le `.prj` et reprojette) plutôt que DuckDB, qui ne reprojette pas automatiquement.
- KML/KMZ : `@tmcw/togeojson` ; CSV : `papaparse` (séparateurs `,` `;` tab détectés, virgule décimale acceptée).
- DXF (lecture) : `dxf-parser` + conversion maison (polylignes avec arcs/bulges, cercles, arcs, ellipses, blocs INSERT, textes).
- DXF sans système de coordonnées : WGS84 si l'étendue ressemble à des degrés, UTM 28N si elle ressemble à des coordonnées UTM du Sénégal, sinon « coordonnées locales » à caler via l'implantation de projet.
- CSV en coordonnées métriques : interprété en UTM 28N (EPSG:32628), avec un avertissement.
- Identifiant stable `_fid` ajouté à chaque objet (les attributs commençant par `_` sont internes et masqués dans la table).
- Ordre des couches : index 0 = dessus de la pile (comme dans QGIS).
- Annuler/rétablir : instantanés immuables (les couches non modifiées sont partagées en mémoire), 60 niveaux.
- Sauvegarde automatique : 0,8 s après la dernière modification, couches puis `site.json`, écriture atomique (fichier temporaire + renommage).
- Vignette d'accueil : capture du canevas de la carte au plus une fois par minute et à la fermeture du site.
- Tuiles raster (OSM, Esri, relief, eau JRC) relayées par `/api/tiles` avec cache disque dans `data/cache/tiles` : respect des politiques d'usage (pas de rechargements répétés) et exports sans problème CORS.
- Courbes de niveau à l'écran : `maplibre-contour` en mode sans worker (le worker est incompatible avec le bundler de Next).
- Polices embarquées (OFL) : Inter, IBM Plex Sans, Jost (proche de Futura, courante en architecture), Source Serif 4 ; servies localement pour que les exports PDF/PNG soient identiques hors ligne.
- Glyphes des étiquettes de la carte : ceux d'OpenFreeMap (Noto Sans) quel que soit le fond.

## Collecte (étape 2)
- Collecte côté serveur en flux NDJSON (progression en direct) ; les fichiers de couches sont écrits par le serveur mais c'est le client qui les ajoute à `site.json` (une seule modification annulable, pas d'écriture concurrente).
- Identifiants de couches déterministes (`osm-batiments`, `gob-batiments`…) : une nouvelle collecte remplace les données en conservant style, ordre et visibilité choisis.
- Sources lancées en parallèle (serveurs différents) ; chaque source échoue indépendamment, avec la raison dans le résumé.
- Overpass : miroirs essayés dans l'ordre (test de joignabilité de 20 s, puis requête avec reprise sur 429/503/504) ; repli sur l'API OSM 0.6 par tuiles de 0,012° seulement si tous les miroirs échouent (cas du bac à sable de développement).
- Overture : fichiers ciblés via le catalogue STAC (`collection.json`) et lus en HTTPS (pas de glob S3), release lue dynamiquement.
- Google Open Buildings : fichier GeoParquet par pays de VIDA (lecture partielle par bbox) ; seules les empreintes `bf_source = google` sont gardées (Microsoft est déjà dans Overture). Pays déterminé par géocodage inverse Nominatim, Sénégal par défaut.
- Relief : courbes de niveau calculées sur le MNS Copernicus GLO-30 (d3-contour + lissage de Chaikin), équidistance automatique (1, 2, 5, 10 ou 20 m) selon le dénivelé ; l'ombrage à l'écran utilise les tuiles Terrarium. Le MNS inclut bâti et végétation : c'est indiqué dans le rapport.
- Population : WorldPop R2025A (année en cours, bornée à 2015-2030), fichier pays téléchargé une fois (pas de lecture partielle possible) ; carroyage d'environ 1 ha en polygones avec population et densité. GHSL non intégré : redondant avec WorldPop + Open Buildings, et tuiles zip de 10 à 40 Mo sans lecture partielle.
- Eau : JRC GSW en couches raster de visualisation (occurrence, changement) + part d'eau calculée sur le GeoTIFF d'occurrence (lecture partielle).
- Source ajoutée : ESA WorldCover 10 m (2021), image colorée selon la palette officielle + répartition des classes.
- Sentinel-2 : image la plus récente couvrant tout le site avec < 5 % (sinon < 10 %) de nuages sur 6 mois, rendue en PNG à environ 4 m/pixel via l'API « data » du Planetary Computer ; d'autres dates peuvent être ajoutées et comparées côte à côte (deux cartes synchronisées).
- Imagerie haute résolution Esri : activée seulement avec `ARCGIS_API_KEY` (conditions Esri), sans cache disque. Mosaïque EOxCloudless : seulement avec `ENABLE_NONCOMMERCIAL_SOURCES=true` (licence non commerciale).
- Tuiles OSM standard : affichage à l'écran seulement ; les exports utilisent un fond OpenFreeMap à la place (politique des tuiles OSMF).
- Tests automatisés sur un build de production isolé (`scripts/test-server.sh`, dossier `.next-test`, port 3100) : le serveur de développement recharge la page à chaque modification de fichier.
