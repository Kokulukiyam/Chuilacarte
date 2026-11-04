# Chuilacarte

Outil cartographique personnel pour l'architecture et l'urbanisme au Sénégal : préparer un site, collecter les données ouvertes, manipuler et annoter les couches, mesurer et analyser, implanter un projet, produire des planches de rendu de qualité, et faire l'aller-retour avec QGIS.

Tout tourne en local, dans le navigateur, sans compte ni mise en ligne. Les données de chaque site sont de simples fichiers dans `data/sites/<site>/`.

---

## 1. Installation

Prérequis : **Node.js 20 ou plus récent** (22 conseillé) et une connexion Internet (collecte de données, fonds de carte).

```bash
# macOS : installer Node si besoin
brew install node

git clone <ce dépôt> chuilacarte
cd chuilacarte
npm install
cp .env.example .env.local   # facultatif : clés et réglages, voir § 3
npm run dev
```

Ouvrez ensuite <http://localhost:3000>.

Au premier lancement d'une collecte ou d'un import GeoPackage, DuckDB télécharge automatiquement ses extensions `spatial` et `httpfs` (quelques Mo, une seule fois).

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run dev` | lancement normal (développement) |
| `npm run build && npm start` | version optimisée, plus rapide |
| `npm test` | tests unitaires (projections, mesures, mise en page, analyses, calage, ombres, DXF) |
| `scripts/test-server.sh 3500` | build isolé servi sur un autre port (tests automatisés) |
| `npx tsx tests/e2e/bout-en-bout.ts http://localhost:3500` | test de bout en bout Playwright (crée puis supprime ses sites `e2e-*`) ; la première fois : `npx playwright install chromium` |

### Dépendances facultatives

Aucune dépendance système n'est **nécessaire** : la lecture des GeoPackage, GeoParquet (Overture), Shapefile, KML et DXF, et l'écriture des GeoPackage, se font sans GDAL (DuckDB + bibliothèques JavaScript).

- **QGIS** (<https://qgis.org>, ou `brew install --cask qgis`) : pour ouvrir les dossiers exportés (§ 6).
- **GDAL** (`brew install gdal`) : non utilisé par l'application ; pratique pour inspecter les fichiers (`ogrinfo`).

## 2. Où sont mes données ?

```
data/
  sites/<site>/
    site.json          emprise, réglages, couches (styles, ordre, sources), mises en page, rapports
    layers/<id>.geojson données de chaque couche vectorielle (WGS84)
    files/             images (Sentinel-2, occupation du sol, plans scannés)
    exports/           copie de chaque export (PNG, PDF, SVG, GeoPackage, DXF, QGIS…)
    thumbnail.png      vignette de l'écran d'accueil
  templates/           modèles de mise en page
  cache/               tuiles, fichiers pays (WorldPop, geoBoundaries) — peut être supprimé
```

Sauvegarder un site = copier son dossier. Le dossier `data/` n'est pas versionné.

## 3. Clés d'API (toutes facultatives)

Renseignez-les dans `.env.local` (modèle : `.env.example`), puis relancez `npm run dev`. Sans clé, la fonction concernée est **désactivée proprement** (bouton grisé et message) ou passe par un service public sans clé.

| Variable | Effet | Comment l'obtenir |
|---|---|---|
| `CHUILACARTE_CONTACT` | adresse ajoutée au User-Agent (règles d'usage de Nominatim, Overpass, Valhalla). **Recommandé.** | votre adresse e-mail |
| `ORS_API_KEY` | isochrones par OpenRouteService (sinon : Valhalla public, sans clé) | compte gratuit sur <https://openrouteservice.org/dev/#/signup> |
| `ARCGIS_API_KEY` | fond satellite haute résolution Esri World Imagery | compte gratuit ArcGIS Location Platform <https://location.arcgis.com/sign-up/>, créer une clé avec le droit « Basemaps » |
| `ENABLE_NONCOMMERCIAL_SOURCES=true` | mosaïque Sentinel-2 sans nuages EOxCloudless (**licence non commerciale**) | — |
| `OVERPASS_URLS`, `VALHALLA_URL` | serveurs à utiliser à la place des serveurs publics par défaut | — |

Le détail des sources, licences et attributions est dans [`SOURCES.md`](SOURCES.md).

## 4. Guide rapide

### Écran d'accueil
Liste des sites avec vignette ; **Renommer**, **Dupliquer**, **Supprimer** sous chaque carte ; **Nouveau site** en haut à droite ; bouton lune/soleil pour le mode sombre.

### Créer un site
**Nouveau site**, puis au choix :
- **Recherche** : tapez un lieu (« Médina, Dakar », « Fatick ») et validez avec Entrée, puis choisissez un résultat : son contour devient l'emprise (un point devient un carré de 400 m) ;
- **Dessin** : rectangle (deux clics) ou polygone (clics, puis clic sur le premier point) ;
- **Import** : GeoJSON, KML/KMZ, GeoPackage, Shapefile zippé, CSV, DXF géoréférencé ; les objets peuvent aussi être gardés comme couche.

Choisissez la **zone tampon** (100 m à 2 km, ou une valeur libre), nommez le site, puis **Créer le site**. La zone tampon se modifie ensuite dans l'onglet **Site**.

### L'espace de travail
Carte au centre, couches à gauche, propriétés et analyses à droite (onglets **Couche**, **Analyse**, **Projet**, **Site**), outils en haut. La sauvegarde est automatique (« Enregistré » en haut). **Annuler / rétablir** : flèches ou Ctrl+Z / Ctrl+Maj+Z. Le bouton ⓘ affiche les raccourcis clavier.

### Collecter les données
**Collecter les données** : cochez les sources et lancez. Chaque couche garde sa source, sa licence et sa date ; le résumé affiche le nombre d'objets par couche et la raison de chaque échec. Une nouvelle collecte met les données à jour en gardant vos styles.

Sources : OpenStreetMap (bâti, voirie hiérarchisée, voies ferrées, eau, occupation du sol, espaces verts, équipements par famille, points d'intérêt), Overture Maps (bâtiments, lieux, réseau), Google Open Buildings (empreintes détectées par satellite, avec indice de confiance), geoBoundaries (régions, départements, arrondissements), Copernicus DEM (courbes de niveau), WorldPop (population à 100 m), ESA WorldCover (occupation du sol 10 m), JRC Global Surface Water (eau et zones inondables), Sentinel-2 (image récente peu nuageuse). Dans l'onglet **Site**, **Chercher des dates** ajoute d'autres images Sentinel-2 ; **Comparer** les affiche côte à côte sur deux cartes synchronisées.

### Fonds de carte
Menu en haut à droite : vectoriel clair, couleur et sombre (OpenFreeMap), OSM standard, satellite haute résolution (avec clé ArcGIS), image Sentinel-2 du site, relief (ombrage et courbes), papier (fond uni sans étiquettes) et blanc. L'ombrage et les courbes peuvent aussi se superposer à n'importe quel fond.

### Couches
- Œil : afficher/masquer ; glisser-déposer : ordre ; double-clic : zoomer sur la couche ; icône tableau : table attributaire ; corbeille : supprimer.
- **Onglet Couche** : nom, opacité, style prédéfini (bibliothèque : bâti gris foncé, plan masse noir, voirie hiérarchisée, eau, végétation, équipements par famille, limites, périmètre…), style **simple / catégorisé / gradué / chaleur**, couleurs, épaisseur, tirets, **hachures**, forme et taille des points, **étiquettes** (attribut, taille, graisse, couleur, halo), **filtre attributaire** (ex. `niveaux > 3`, `famille = santé`), libellé de légende.
- **Table attributaire** : tri par colonne, recherche, modification directe des cellules ; un clic sur une ligne sélectionne l'objet et zoome dessus.
- **Importer** : ajoute un fichier comme couche (GeoJSON, KML, GeoPackage, Shapefile zippé, CSV avec colonnes longitude/latitude, DXF géoréférencé, zip de dossier exporté de QGIS).
- **Édition** (onglet Couche, objet sélectionné ; Maj + clic pour en sélectionner plusieurs) : modifier les sommets / déplacer à la souris, découper par une ligne, fusionner, séparer, rotation, mise à l'échelle, déplacement au mètre, dupliquer, supprimer (Suppr). « Ajouter un objet à cette couche » dessine directement dans la couche.

### Annoter
Outils de la barre du haut : point (P), ligne (L), polygone (G), rectangle (R), cercle (C), flèche (A), croquis à main levée (F), texte (T), repère numéroté (N), cotation (D). Pendant le dessin, une barre règle couleur, épaisseur, taille et graisse. Terminer une ligne : recliquer le dernier point ; un polygone : cliquer le premier point. Les annotations forment une couche comme les autres (éditable, exportable) ; chaque objet se règle ensuite dans l'onglet Couche (texte, légende du repère, couleur, taille, rotation, double flèche…). Les repères numérotés alimentent automatiquement la légende.

### Mesurer et analyser (onglet Analyse)
- **Distance** (M) et **surface / périmètre** (S), calculées dans la projection UTM du site ; « Garder sur la carte » transforme la mesure en cotation ou en polygone.
- **Synthèse d'une zone** (emprise, emprise + tampon, zone dessinée ou polygone sélectionné), avec comparaison facultative de deux zones côte à côte et export **CSV** : surface totale et bâtie, emprise au sol (CES), nombre et taille moyenne des bâtiments, surface de plancher et densité (COS), linéaire et densité de voirie par type, équipements par famille et distance au plus proche, population et densité, part d'espaces verts et d'eau.
- **Profil topographique** le long d'une ligne (graphique, dénivelés, CSV).
- **Isochrones** à pied, à vélo ou en voiture (durées au choix) depuis un point.
- **Zone tampon** autour d'une couche ou des objets sélectionnés.
- **Carte de chaleur** et **carte de densité** (hexagones) sur une couche de points.

### Implanter un projet (onglet Projet)
- **Plan DXF** (export AutoCAD, coordonnées locales ; unités automatiques ou à préciser) : il est posé au centre de la vue. **Déplacer à la souris**, flèches (1 m), rotation, échelle, ou **calage par points** : cliquez un point du plan puis le point réel sur la carte, 2 ou 3 fois, puis **Appliquer** (l'écart moyen est affiché avec 3 points). Un DXF déjà géoréférencé (UTM 28N) est placé directement.
- **Image / scan** : même calage, avec réglage de transparence.
- **Dessiner l'emprise** du projet.
- **Programme** : nombre de niveaux et hauteur d'étage → emprise au sol, surface de plancher, CES et COS par rapport à la parcelle (calque DXF « PARCELLE », ou un polygone sélectionné).
- **Vue 3D** (bouton 3D ou touche 3) : extrusion du bâti existant (hauteur ou niveaux connus, sinon hauteur par défaut réglable) et du projet. Clic droit + glisser pour incliner et tourner.
- **Ombres portées** : date, heure (heure du Sénégal = UTC) ou curseur, raccourcis solstices/équinoxe ; ombres du projet et du bâti voisin.

### Mise en page et exports
**Mise en page** ouvre l'éditeur de planche : format (A4 à A0 ou personnalisé), orientation, **échelle exacte** (1/500 à 1/50 000 ou libre), rotation, fond (par défaut « Papier + noms de rues » : fond uni, mer en bleu pâle et noms des rues, pour que seules les couches du site soient dessinées), facteur d'épaisseurs et de symboles (adapté au format), police (Inter, IBM Plex Sans, Jost, Source Serif 4). Le sous-titre suit l'échelle (plan masse, plan de l'îlot, plan de quartier, plan de situation) tant qu'il n'est pas modifié. Les éléments (titre, sous-titre, légende générée et modifiable, barre d'échelle, flèche du nord, cartouche, encart de situation, texte libre, logo) se déplacent à la souris et se redimensionnent avec la poignée bleue ; glisser dans le cadre déplace la carte. **Exporter** : **PNG 300 dpi**, **PDF vectoriel**, **SVG** (Illustrator). Les attributions des sources sont toujours écrites sur la carte. **Enregistrer comme modèle** garde une disposition réutilisable sur d'autres sites.

**Exporter** (barre du haut) : couches visibles en **GeoPackage** (UTM du site, styles QGIS inclus), **GeoJSON** (WGS84) ou **DXF** (mètres, UTM du site, pour AutoCAD). Le filtre attributaire de chaque couche est appliqué.

## 5. Systèmes de coordonnées

- Stockage : WGS 84 (EPSG:4326).
- Mesures, analyses, GeoPackage, DXF et projet QGIS : UTM de la zone du site, choisie automatiquement (zone 28N, EPSG:32628, pour Dakar, Thiès, Fatick, Kaolack, Saint-Louis… ; 29N à l'extrême est).
- Mises en page : Web Mercator corrigé de l'ellipsoïde, échelle exacte au centre du cadre (écart mesuré < 0,01 % en est-ouest comme en nord-sud sur les planches d'exemple), nord en haut.

## 6. Aller-retour avec QGIS

**Vers QGIS** : bouton **QGIS** → un zip `<site>-qgis.zip`. Décompressez-le et ouvrez `<site>.qgs` (QGIS 3.22 ou plus récent). Il contient :
- `<site>.gpkg` : toutes les couches vectorielles, en UTM du site, avec leurs styles (aussi enregistrés dans le GeoPackage : il s'ouvre stylé même seul) ; les couches mélangeant points, lignes et polygones (annotations) sont réparties en une table par type ;
- le projet, avec les couches dans l'ordre de Chuilacarte, leurs styles (simple, catégorisé, gradué, chaleur, hachures, étiquettes), le fond de carte en couche XYZ et les images calées (`images/`) ;
- `LISEZMOI.txt` avec les sources à citer.

**Retour depuis QGIS** : enregistrez les couches créées ou modifiées en GeoPackage (*Exporter → Sauvegarder les entités sous… → GeoPackage*, n'importe quelle projection), en GeoJSON ou en Shapefile zippé, puis dans Chuilacarte **Importer** ce fichier dans le site : chaque table devient une couche, reprojetée en WGS 84. Un zip contenant plusieurs fichiers (par exemple le dossier exporté) est accepté.

Conseil : gardez dans QGIS les traitements avancés (géotraitements lourds, rasters, atlas) et revenez dans Chuilacarte pour l'habillage et les rendus.

## 7. Limites connues

Voir [`RAPPORT.md`](RAPPORT.md) (rapport final), [`DECISIONS.md`](DECISIONS.md) (choix techniques) et les rapports de contrôle dans [`exemples/`](exemples/).
