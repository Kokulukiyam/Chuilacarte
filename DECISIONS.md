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

## Couches, annotations, mesures (étapes 3-4)
- Les annotations vont dans une couche « Annotations » (créée au premier dessin) ; chaque objet porte ses propres réglages graphiques (`_color`, `_width`, `_size`…), modifiables après coup. Plusieurs couches d'annotations sont possibles (la couche sélectionnée reçoit les nouveaux dessins).
- Textes et légendes des repères saisis par une boîte de dialogue simple, modifiables ensuite dans le panneau de droite.
- Cotations : segment entre le premier et le dernier point, longueur calculée en UTM, texte personnalisable.
- Découpe d'un polygone : intersection/différence avec le demi-plan à gauche de la ligne de coupe (les deux parties partagent exactement la ligne, donc se refusionnent proprement).
- Sélection multiple par Maj + clic (même couche) pour la fusion.
- Rotation et mise à l'échelle par boutons (±5°, ±10 %) en plus du glisser et de l'édition des sommets (Terra Draw).
- Le clic qui termine un tracé est ignoré par la sélection (400 ms).

## Mise en page et exports (étape 5)
- Une seule chaîne de rendu : la mise en page est produite en SVG (unités = millimètres) ; l'aperçu, l'export SVG, le PDF (svg2pdf.js + jsPDF, polices embarquées) et le PNG (resvg côté serveur) en dérivent, donc tous identiques.
- Projection du cadre : Web Mercator, échelle vraie au centre du cadre (écart < 0,1 % sur l'étendue d'un site) ; le nord est en haut (sauf rotation choisie, la flèche du nord suit).
- Les couches du site sont vectorielles dans les exports ; le fond de carte (et les rasters du site : Sentinel-2, occupation du sol, eau, plans calés) est rendu par une carte MapLibre hors écran, par morceaux de 2048 px, avec un rapport de pixels dpi/96 pour garder la taille physique des étiquettes du fond.
- Résolution du fond limitée à 64 mégapixels (≈ 200 dpi en A0, 300 dpi jusqu'à l'A2) pour tenir en mémoire ; les vecteurs, textes et habillage restent à la résolution de l'export.
- Épaisseurs, tailles de symboles et d'étiquettes : 1 px écran = 0,2646 mm papier (96 dpi), pour que la carte imprimée ressemble à l'écran.
- Halo des étiquettes : texte détouré dupliqué sous le texte plein (et non `paint-order`), pour un rendu identique dans le PDF, Illustrator et le PNG.
- Les attributions de toutes les sources visibles et du fond sont toujours écrites dans le cadre de carte (et, par défaut, dans le cartouche).
- PNG : densité 300 dpi inscrite dans le fichier ; une copie de chaque export est gardée dans `data/sites/<site>/exports/`.
- Exports de données : le filtre attributaire de chaque couche est appliqué (ce qu'on voit est ce qu'on exporte) ; GeoPackage et DXF en UTM du site (mètres), GeoJSON en WGS84.
- GeoPackage écrit directement (SQLite via better-sqlite3, en-têtes GeoPackage + WKB) : plusieurs couches dans un fichier et styles QGIS intégrés dans la table `layer_styles` (chargés automatiquement par QGIS).
- DXF R12 (AC1009) : le format le plus largement relu (AutoCAD, QGIS, LibreCAD, ezdxf) ; un calque DXF par couche, couleur ACI la plus proche.
- Disposition par défaut : paysage = colonne d'habillage à droite (titre, nord, échelle, légende, encart, cartouche) ; portrait = bandeau en bas. Tailles proportionnelles au format.
- Encart de situation : contours geoBoundaries simplifiés du pays et des régions.
- Modèles de mise en page enregistrés dans `data/templates/` (sans le centre de la carte, pour être réutilisables sur d'autres sites).

## Pont QGIS (étape 6)
- Export QGIS = un zip contenant un dossier : GeoPackage unique (toutes les couches vectorielles, visibles ou non, en UTM du site), projet `.qgs` (XML lisible, chemins relatifs), images calées en PNG + `.pgw` (WGS84), fond XYZ, LISEZMOI.
- Styles écrits deux fois : dans le projet (renderer + étiquettes) et dans la table `layer_styles` du GeoPackage (le GeoPackage seul s'ouvre donc aussi stylé).
- Symbologie QGIS en millimètres (1 px = 0,2646 mm), symboles `<prop>` compatibles QGIS 3.x ; annotations : couleur pilotée par l'attribut `couleur`.
- Fond XYZ du projet : tuiles OSM (QGIS les charge lui-même en interactif, ce que la politique OSM tolère) ; les fonds vectoriels OpenFreeMap n'ayant pas d'équivalent XYZ raster, l'équivalent raster OSM est proposé.
- Retour depuis QGIS : l'import accepte GeoPackage (toutes projections, reprojeté par DuckDB/PROJ), Shapefile zippé, GeoJSON, et un zip de dossier (GeoPackage/GeoJSON/KML/CSV/DXF contenus).

## Analyses (étape 7)
- Synthèse calculée dans le navigateur, en UTM : surfaces bâties découpées exactement à la zone (intersection), longueurs de voirie découpées exactement aux bords de la zone, population pondérée par la part de chaque carreau dans la zone, espaces verts et eau en union (pas de double compte).
- Couche de bâti : la plus complète dans la zone (souvent Google Open Buildings à Dakar), ou choisie ; la même couche est utilisée pour toutes les zones comparées.
- Surface de plancher : bâtiments avec `niveaux` (ou `hauteur` / hauteur d'étage) comptés exactement ; les autres avec une hypothèse (hauteur par défaut / hauteur d'étage, 2 niveaux par défaut) affichée dans le tableau.
- Distance au plus proche équipement de chaque famille : depuis le centre de la zone, en ligne droite (UTM).
- Profil : MNS Copernicus GLO-30 interpolé (bilinéaire), pas d'échantillonnage adapté à la longueur (2 à 50 m).
- Isochrones : OpenRouteService si `ORS_API_KEY`, sinon Valhalla FOSSGIS (1 requête/s), durées libres (5 max, 60 min max).
- Carte de chaleur : style « Chaleur » de MapLibre (rendue avec le fond dans les exports, car non vectorielle) ; carte de densité : grille hexagonale (taille réglable) avec nombre et densité par hectare.
- Zones d'analyse dessinées gardées dans une couche « Zones d'analyse » (réutilisables, exportables).
