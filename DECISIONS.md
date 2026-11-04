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
