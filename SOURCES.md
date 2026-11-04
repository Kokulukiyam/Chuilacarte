# SOURCES.md — Sources de données de Chuilacarte

Vérification faite le **4 novembre 2026** par l'agent de vérification des sources. Les tests ont été lancés depuis un bac à sable Linux, dont la sortie HTTPS passe par un proxy. Certains hôtes y étaient injoignables. C'est signalé à chaque fois et **ne veut pas dire que le service est hors ligne**.

Emprise de test : Dakar (Plateau et Médina), bbox `lon -17.46..-17.43, lat 14.66..14.69`. Certaines requêtes portent sur une sous-emprise de 0,01° × 0,01° (`-17.45,14.68,-17.44,14.69`, Médina, environ 1,1 km × 1,1 km).

Contexte d'usage retenu : outil personnel et local sur un Mac, sans mise en ligne. Les cartes sont exportées avec attribution, avec mise en cache locale des données d'un site.

> **Point d'attention commun : usage professionnel.** L'utilisateur est architecte-urbaniste. Ses planches de rendu peuvent donc entrer dans une activité rémunérée, même si l'outil reste personnel. Toutes les sources retenues par défaut autorisent l'usage commercial avec attribution (ODbL, CC BY, CDLA, domaine public). Les rares sources limitées au **non commercial** sont signalées par ⚠️ NC et ne doivent pas être activées par défaut.

---

## 1. Tableau récapitulatif

| # | Source | Apporte | Licence | Clé | Accès testé ici | Statut |
|---|---|---|---|---|---|---|
| 1 | OSM via Overpass | bâti, voirie, eau, équipements, POI, limites communales | ODbL 1.0 | non | ✅ via `maps.mail.ru` (504 par intermittence) ; ❌ `overpass-api.de`, kumi, private.coffee injoignables d'ici | **Intégrée** |
| 1b | OSM API 0.6 `/map.json` | repli brut pour une petite emprise | ODbL 1.0 | non | ✅ 726 Ko en 1,3 s | **Repli seulement** |
| 2 | Overture Maps (GeoParquet) | bâtiments (OSM + Google + Microsoft conflués), lieux, voirie, occupation du sol | ODbL (bâti, voirie, base) ; CDLA-Permissive-2.0 et autres (places) | non | ✅ DuckDB, 1,5 à 2,5 s par thème | **Intégrée** |
| 3 | Google Open Buildings v3 (via VIDA, source.coop) | empreintes avec `confidence` | ODbL (fichier fusionné VIDA) ; Google seul en CC BY 4.0 | non | ✅ lecture partielle d'un fichier de 836 Mo en 5 s | **Intégrée** |
| 3b | Google Open Buildings v3 (GCS, CSV par cellule S2) | idem, données brutes Google | CC BY 4.0 ou ODbL au choix | non | ✅ 165 Mo (gzip) pour Dakar, sans lecture partielle | Repli |
| 3c | Google Open Buildings 2.5D Temporal | présence, hauteur et comptage du bâti, 2016 à 2023, raster | CC BY 4.0 | non | ✅ lecture partielle d'un COG en 3,5 s | Optionnelle |
| 4 | geoBoundaries gbOpen SEN | régions (14), départements (45), arrondissements (121) | CC BY 3.0 IGO | non | ✅ API ; fichiers servis par `media.githubusercontent.com` | **Intégrée** |
| 5a | AWS Terrain Tiles (Terrarium) | MNT tuilé, ombrage, courbes | domaine public (SRTM, ETOPO1) avec crédits | non | ✅ jusqu'à z15 | **Intégrée** |
| 5b | Copernicus DEM GLO-30 (COG AWS) | MNS 30 m pour profils et courbes | licence Copernicus DEM (gratuite, attribution) | non | ✅ lecture partielle en 1 s | **Intégrée** |
| 6a | WorldPop R2025A 100 m (constrained) | population par pixel, 2015 à 2030 | CC BY 4.0 | non | ✅ 17,5 Mo par pays, sans lecture partielle | **Intégrée** |
| 6b | GHSL GHS-POP / GHS-BUILT-S R2023A | population et surface bâtie à 100 m (époque 2025) | CC BY 4.0 (© UE) | non | ✅ tuile R8_C17 (11 Mo et 40 Mo en zip) | **Intégrée** |
| 7 | JRC Global Surface Water | occurrence et variations de l'eau, 1984 à 2021 ; tuiles 2024 | CC BY 4.0 (© UE, Copernicus) | non | ✅ tuiles XYZ et GeoTIFF à lecture partielle | **Intégrée** |
| 8a | Sentinel-2 L2A, Microsoft Planetary Computer | image récente peu nuageuse, multi-dates | données Copernicus (libres, attribution) | non | ✅ STAC, rendu PNG par bbox en 1,9 s | **Intégrée** |
| 8b | Sentinel-2, Copernicus Data Space | idem | idem | **compte requis** pour les fichiers | ✅ STAC seul | Repli (avec compte) |
| 9a | OpenFreeMap (liberty, positron, dark, bright, fiord) | fonds vectoriels, glyphes, sprites | ODbL (données) ; styles libres | non | ✅ | **Intégrée** |
| 9b | Protomaps | fonds vectoriels | ODbL (données) | clé pour l'API ; sans clé avec un PMTiles extrait | API 403 sans clé ; builds lisibles par plage d'octets | Optionnelle |
| 9c | Tuiles OSM standard `tile.openstreetmap.org` | fond OSM | ODbL (données) ; tuiles CC BY-SA 2.0 | non | ✅ | **Intégrée (écran seulement)** |
| 9d | Esri World Imagery | imagerie haute résolution | Esri Master License Agreement | **clé ArcGIS de fait** | ✅ techniquement, sans clé | **Optionnelle avec clé** |
| 9e | EOxCloudless (ex-s2cloudless) 2016 à 2025 | mosaïque Sentinel-2 à 10 m sans nuages | ⚠️ NC : CC BY-NC-SA 4.0 ; commercial sous licence EOX | non | ✅ | Optionnelle (NC) |
| 10a | Nominatim (OSMF) | géocodage | ODbL | non | ✅ (403 avec un User-Agent contenant `example.org`) | **Intégrée** |
| 10b | Photon (komoot) | géocodage, autocomplétion permise | ODbL | non | ✅ | **Intégrée** (autocomplétion) |
| 11a | Valhalla FOSSGIS `valhalla1.openstreetmap.de` | isochrones à pied, à vélo, en voiture | service : conditions FOSSGIS ; données ODbL | non | ✅ 0,5 s | **Intégrée (défaut sans clé)** |
| 11b | OpenRouteService | isochrones | données ODbL ; service gratuit | **oui** (gratuite) | 401 sans clé (attendu) | **Intégrée si clé** |
| 12 | ESA WorldCover 10 m v200 (2021) | occupation du sol à 10 m (bâti, arbres, eau, mangroves…) | CC BY 4.0 | non | ✅ COG en 0,9 s | **Intégrée (supplément)** |

---

## 2. Conventions techniques communes (à coder une seule fois)

- **User-Agent** obligatoire et identifiant sur toutes les requêtes côté serveur (routes API Next.js), par exemple `Chuilacarte/0.1 (+contact: <email réel de l'utilisateur>)`. Prévois une variable `CHUILACARTE_CONTACT` dans `.env.local`.
  - Constaté ici : Nominatim a répondu **403** à un User-Agent contenant `test@example.org`, puis **200** avec `Chuilacarte/0.1 (+https://github.com/chuilacarte)`. N'utilise donc jamais d'adresse factice.
- **Cache local** : par site, dans `data/sites/<slug>/`. Les fichiers par pays ou par tuile sont partagés (WorldPop, tuiles GHSL, cellules Google Open Buildings) et vont dans un cache global, par exemple `data/cache/`. Ils sont téléchargés une seule fois.
- **DuckDB (≥ 2.0)**, constaté avec le paquet Python 2.0.0, à vérifier avec `@duckdb/node-api` :
  - `INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;`
  - `SET geometry_always_xy = true;` est **obligatoire** depuis la version 2.0, sinon l'export GDAL (GPKG) échoue avec une erreur sur l'ordre des axes.
  - La syntaxe lambda `x -> …` est rejetée. Écris `list_transform(l, lambda x: x.champ)`.
  - Le glob `*` sur une URL `https://` n'est **pas** permis. Il faut des URL de fichiers explicites, ou le glob sur `s3://`.
  - L'écriture GeoPackage a été testée : `COPY (…) TO 'x.gpkg' WITH (FORMAT GDAL, DRIVER 'GPKG')` fonctionne, puis `ST_Read('x.gpkg')`.
- **Rasters (COG)** : la lecture partielle par requêtes HTTP Range fonctionne pour Copernicus DEM, GSW, WorldCover et Open Buildings Temporal. Côté Node, utilise `geotiff.js` (`fromUrl` puis `readRasters({window})`) ou GDAL en option. **WorldPop ne gère pas les requêtes Range** (« Range downloading not supported »). Il faut télécharger le fichier entier, 17,5 Mo.
- Les objets publics Google Cloud Storage peuvent être listés sans authentification : `https://storage.googleapis.com/storage/v1/b/<bucket>/o?prefix=…&delimiter=/`.
- Particularité du bac à sable, absente sur le Mac : des identifiants AWS sont injectés par le proxy, donc `s3://` renvoyait « Invalid Access Key ». Les URL `https://…s3.us-west-2.amazonaws.com/…` fonctionnent toujours, sans identifiants : **préfère-les**.

---

## 3. Fiches des sources intégrées

### 3.1 OpenStreetMap via l'API Overpass

- **Apporte** : bâti (`building=*`, avec `building:levels` et `height` quand ils existent), voirie hiérarchisée (`highway=*`), voies ferrées, hydrographie (`waterway`, `natural=water`), occupation du sol (`landuse`, `natural`, `leisure=park`), équipements (`amenity=school|hospital|clinic|place_of_worship|marketplace|townhall…`, `public_transport`), POI. On y trouve aussi les **communes** du Sénégal, ce que geoBoundaries n'a pas : `boundary=administrative` + `admin_level=8`. Sur la Médina, `is_in` renvoie : 2 Sénégal, 4 Région de Dakar, 5 Dakar, 7 Arrondissement de Dakar-Plateau, 8 Commune de Médina.
- **Licence** : ODbL 1.0. Affichage, export et cache local permis avec attribution. Une base dérivée qu'on redistribue doit rester sous ODbL, ce qui ne pose pas de problème pour un usage personnel.
- **Attribution à afficher** : `© les contributeurs d'OpenStreetMap (ODbL)`, avec un lien vers https://www.openstreetmap.org/copyright à l'écran.
- **Limites d'usage** :
  - Instance principale `overpass-api.de` (FOSSGIS) : moins de 10 000 requêtes et moins de 1 Go par jour. Les conditions FOSSGIS demandent aussi un User-Agent identifiant, au plus 2 connexions (1 pour un script) et interdisent le téléchargement de masse.
  - Le miroir `maps.mail.ru` (VK) ne publie pas de politique. Reste raisonnable : une requête à la fois.
- **Clé** : aucune.
- **Méthode d'accès testée** :
  - `POST https://maps.mail.ru/osm/tools/overpass/api/interpreter` avec un corps `data=<requête>` (urlencodé).
  - Requête qui a marché (zone de 0,005° × 0,005° : 316 Ko en 55 s) :
    ```
    [out:json][timeout:60];
    (way["building"](14.675,-17.45,14.68,-17.445);
     way["highway"](14.675,-17.45,14.68,-17.445);
     nwr["amenity"](14.675,-17.45,14.68,-17.445););
    out geom tags;
    ```
    La bbox Overpass s'écrit **(sud, ouest, nord, est)**. `out geom` renvoie directement les coordonnées des ways, sans recomposition des nœuds. Conversion vers GeoJSON avec `osmtogeojson` (npm).
  - Comptage : `way["building"](14.68,-17.45,14.69,-17.44);out count;` renvoie **1587** bâtiments sur environ 1,2 km² de Médina.
  - Limites admin. : `is_in(14.68,-17.445)->.a;rel(pivot.a)["boundary"="administrative"];out tags;` (22 s).
  - Liste d'instances à essayer dans l'ordre, avec reprise et délai croissant, **une seule à la fois** : `https://overpass-api.de/api/interpreter`, `https://maps.mail.ru/osm/tools/overpass/api/interpreter`, `https://overpass.private.coffee/api/interpreter`, `https://overpass.kumi.systems/api/interpreter`. Mets `[timeout:90]` et un délai client de 120 s. Traite les codes 429 et 504 comme « réessayer plus tard ».
- **Résultat du test ici** :
  - `overpass-api.de`, `z.` et `lz4.overpass-api.de` : connexion réinitialisée par le proxy du bac à sable (blocage local probable).
  - `overpass.kumi.systems`, `overpass.private.coffee` : délai dépassé après 60 à 120 s.
  - `overpass.osm.jp` : erreur de certificat.
  - `maps.mail.ru` : ✅ données de la minute (`timestamp_osm_base` du jour), mais **504 sur 2 tentatives sur 5**, d'où la reprise automatique indispensable.

### 3.1b Repli : API OSM 0.6 `/api/0.6/map.json`

- `GET https://api.openstreetmap.org/api/0.6/map.json?bbox=-17.45,14.675,-17.445,14.68` (bbox dans l'ordre **ouest,sud,est,nord**) : ✅ 200, 726 Ko en 1,3 s. Les limites lues dans `/api/capabilities.json` : surface max **0,25 deg²**, 50 000 nœuds, timeout 300 s.
- **Politique OSMF** : l'API sert « à éditer, pas à des usages en lecture seule ». Les gros consommateurs ou les usages fréquents sont redirigés vers planet ou Overpass. Au plus 2 fils, User-Agent identifiant, blocage possible sans préavis.
- **Verdict** : acceptable **uniquement en repli**, ponctuellement, pour un site de quelques km², quand toutes les instances Overpass échouent. Il ne faut **pas** en faire le chemin normal. Le résultat est du JSON brut (nœuds et ways séparés) qu'il faut recomposer, ce que `osmtogeojson` sait faire.
- Autre repli testé : l'extrait Geofabrik `https://download.geofabrik.de/africa/senegal-and-gambia-latest.osm.pbf` (lisible par DuckDB avec `ST_ReadOSM`) était **injoignable depuis ce bac à sable** (connexion réinitialisée). Pas de conclusion possible.

### 3.2 Overture Maps (GeoParquet)

- **Apporte** :
  - `buildings/building` : bâti conflué OSM + Google Open Buildings + Microsoft. Sur la Médina (0,01°²) : 3279 bâtiments, dont 1593 OSM, 1403 Google (avec `sources[1].confidence`, moyenne 0,74) et 283 Microsoft. Les champs `height` et `num_floors` sont quasi vides à Dakar (6 sur 3279).
  - `places/place` : 143 lieux sur la même emprise, avec nom, `basic_category`, `taxonomy.hierarchy`, `confidence`, téléphones et sites web.
  - `transportation/segment` : 461 segments, avec `subtype`, `class`, `road_surface` et `names`.
  - `base/land_use` (36) et `base/water`.
- **Dernière release** : **`2026-10-21.0`** (précédentes : `2026-09-23.0` et `.1`). Le bucket ne garde que les dernières releases : **ne code jamais la release en dur**. Lis `https://stac.overturemaps.org/catalog.json`, champ `"latest"`.
- **Licences par thème** :
  - buildings, transportation, base, divisions : **ODbL** ;
  - places : pas de licence de thème. Chaque enregistrement a la sienne dans `sources[].license` : surtout **CDLA-Permissive-2.0** (Meta, Microsoft), Foursquare en Apache 2.0, AllThePlaces en CC0 ;
  - le bâti issu de Google Open Buildings et d'Esri Community Maps est en CC BY 4.0, celui de Microsoft en ODbL.
- **Attribution à afficher** : `© Overture Maps Foundation, © les contributeurs d'OpenStreetMap` (forme utilisée par Overture). Ajoute selon la couche :
  - bâti : `Google Open Buildings (CC BY 4.0), Microsoft Global ML Building Footprints (ODbL)` ;
  - lieux : `Meta, Microsoft (CDLA-Permissive-2.0), Foursquare (Apache 2.0)`.

  Page de référence : https://docs.overturemaps.org/attribution/
- **Limites d'usage** : aucune clé, pas de quota (bucket public AWS, ou Azure en miroir). Chaque fichier fait **500 à 1100 Mo**, mais on n'en lit que quelques Mo grâce aux statistiques par groupe de lignes.
- **Les colonnes `bbox` permettent-elles un filtrage efficace ?** **Oui.** `bbox` est une STRUCT (`xmin`, `ymin`, `xmax`, `ymax`) avec des statistiques min et max par groupe de lignes (256 groupes par fichier pour le bâti). DuckDB saute les groupes hors emprise. Résultat mesuré : 1,5 à 2,5 s par thème depuis ce bac à sable, avec un fichier ciblé.
- **Méthode d'accès testée** :
  1. `GET https://stac.overturemaps.org/<release>/<theme>/<type>/collection.json`. On y trouve :
     - `extent.spatial.bbox[1:]`, une bbox par fichier, **dans le même ordre** que les `links` `rel=item` ;
     - `partition:glob` ;
     - `table:columns`.

     Filtre les fichiers dont la bbox recoupe le site.

     Fichiers couvrant Dakar dans `2026-10-21.0` :
     - building : item `00099`, 571 Mo ;
     - place : `00005` ;
     - segment : `00036` ;
     - land_use : `00005` et `00008` ;
     - water : `00017`.
  2. `GET …/<type>/<NNNNN>/<NNNNN>.json` : `assets.aws.href`, par exemple `https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=buildings/type=building/part-00099-834a6574-eb5d-5577-9ba7-c516548ac3d6-c000.zstd.parquet`.
  3. DuckDB :
     ```sql
     SET geometry_always_xy = true;
     COPY (
       SELECT id, sources[1].dataset AS source, sources[1].confidence AS confidence,
              height, num_floors, class, geometry
       FROM read_parquet('<url>')
       WHERE bbox.xmin < -17.44 AND bbox.xmax > -17.45
         AND bbox.ymin < 14.69  AND bbox.ymax > 14.68
     ) TO 'buildings_overture.gpkg' WITH (FORMAT GDAL, DRIVER 'GPKG');
     ```
     Formule générique : `bbox.xmin < E AND bbox.xmax > W AND bbox.ymin < N AND bbox.ymax > S`. Ajoute ensuite `ST_Intersects(geometry, <emprise>)` pour la découpe exacte.

     Places : `names.primary`, `basic_category`, `taxonomy.primary`, `confidence`. Attention, l'ancien champ `categories` **n'existe plus** et a été remplacé par `taxonomy` et `basic_category`.
  - Variante sans STAC, avec `s3://` (glob permis) : `read_parquet('s3://overturemaps-us-west-2/release/<rel>/theme=buildings/type=building/*', hive_partitioning=1)` et `SET s3_region='us-west-2'`. C'est plus lent, car DuckDB lit les 512 pieds de fichier.
- **Résultat du test ici** : ✅ pour les 5 thèmes. `building_part` est vide sur Dakar (aucun fichier ne recoupe).

### 3.3 Google Open Buildings v3 (polygones), version GeoParquet de VIDA

- **Apporte** : empreintes de bâtiments détectées par satellite, avec `confidence` (≥ 0,65) et `area_in_meters`. C'est bien plus complet qu'OSM : **4805 bâtiments Google + 32 Microsoft** sur la même emprise de Médina, contre 1587 dans OSM.
- **Source recommandée** : le jeu fusionné « google-microsoft-open-buildings » de VIDA sur source.coop, fichier par pays. Google v3 (mai 2023) et Microsoft (mis à jour le 28/05/2024).
- **Licence** : **ODbL 1.0** pour le fichier fusionné VIDA. La couche Google seule est sous CC BY 4.0 **ou** ODbL, au choix de l'utilisateur.
- **Attribution à afficher** : `Google Open Buildings v3 (CC BY 4.0 / ODbL) ; Microsoft Global ML Building Footprints (ODbL) ; compilation VIDA via Source Cooperative (ODbL)`.
- **Limites d'usage** : pas de clé ni de quota publié. Fichier Sénégal de **836 Mo**, lu partiellement.
- **Méthode d'accès testée** :
  - URL : `https://data.source.coop/vida/google-microsoft-open-buildings/geoparquet/by_country/country_iso=SEN/SEN.parquet` (836 285 186 octets, `accept-ranges: bytes`). Une variante existe avec OSM : `…/google-microsoft-osm-open-buildings/…/SEN.parquet` (874 Mo).
  - Colonnes : `boundary_id`, `bf_source` (`google` ou `microsoft`), `confidence`, `area_in_meters`, `s2_id`, `country_iso`, `geohash`, `geometry` (EPSG:4326), `bbox` (struct). 1341 groupes de lignes, 6,7 M bâtiments au Sénégal. Le fichier est trié spatialement par `boundary_id` : les statistiques `bbox` des groupes de lignes sont serrées.
  - Requête testée (5,2 s) :
    ```sql
    SELECT bf_source, count(*), avg(confidence)
    FROM read_parquet('https://data.source.coop/vida/google-microsoft-open-buildings/geoparquet/by_country/country_iso=SEN/SEN.parquet')
    WHERE bbox.xmin < -17.44 AND bbox.xmax > -17.45 AND bbox.ymin < 14.69 AND bbox.ymax > 14.68
    GROUP BY 1;   -- google 4805 (conf. moy. 0,754), microsoft 32
    ```
  - Une partition plus fine existe : `…/geoparquet/by_country_s2/country_iso=SEN/<S2_ID>.parquet`.
- **Résultat du test ici** : ✅.

### 3.3b Repli : Google Open Buildings v3 brut (Google Cloud Storage)

- Fichiers CSV gzip par cellule S2, sans en-tête au niveau 6 : `https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_6_gzip_no_header/<token>_buildings.csv.gz`.
  - Colonnes v3 : `latitude, longitude, area_in_meters, confidence, geometry (WKT), full_plus_code`.
  - Token S2 de niveau 6 : Dakar, Médina et Yoff = `0ec1` (**164,8 Mo**) ; Fatick = `0ee9` (**113,9 Mo**). Niveau 4 : `polygons_s2_level_4_gzip/0ed_buildings.csv.gz` (227 Mo).
  - Calcul du token : `s2.CellId.from_lat_lng(...).parent(6).to_token()`. En npm : `s2-geometry` ou `@radarlabs/s2`.
- Le gzip ne permet **pas** de lecture partielle. Il faut tout télécharger une fois, filtrer en flux et garder en cache par cellule. À n'utiliser que si source.coop est indisponible.
- Licence : CC BY 4.0 ou ODbL au choix. Attribution : `Google Open Buildings (CC BY 4.0)`.

### 3.3c Optionnel : Google Open Buildings 2.5D Temporal (raster, 2016 à 2023)

- **Apporte** : bandes `building_presence`, `building_height` (m) et `building_fractional_count`, une couche par année (au 30 juin, de 2016 à 2023). C'est la seule source de **hauteurs** un peu systématique à Dakar.
- **Licence** : CC BY 4.0. **Attribution** : `Google Open Buildings 2.5D Temporal (CC BY 4.0)`.
- **Accès testé** :
  1. Manifeste par cellule S2 de niveau 2 et par zone UTM : `https://storage.googleapis.com/open-buildings-temporal-data/v1/manifests/0f_EPSG_32628_2023_06_30.json` (2,4 Mo). Il contient `uriPrefix` et `tilesets[].sources[]` avec `uris` et `affineTransform` (`translateX`/`translateY` en mètres UTM 28N, pas de 0,5 m, tuiles de 25 000 × 25 000 px).
  2. Prends la tuile qui contient le site. Pour la Médina : `gs://open-buildings-temporal-data/v1/geotiffs/0ec14_2023_06_30/tile_jV7F2biR_A4.tif`, servie en `https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/0ec14_2023_06_30/tile_jV7F2biR_A4.tif`. Il s'agit d'un COG de 10 Mo (3 bandes float32, nodata -99, deflate, blocs de 512).
  3. Lecture partielle de 0,01°² en 3,5 s : hauteur max 60 m.
- Plus complexe que les autres sources : à intégrer **après** le socle.

### 3.4 geoBoundaries (gbOpen, Sénégal)

- **Apporte** : ADM1 = 14 régions, ADM2 = 45 départements, ADM3 = **121 arrondissements** (par exemple Almadies, Grand Dakar, Plateau). **Il n'y a ni ADM4 ni communes** (`/ADM4/` renvoie 404). Pour les communes, utilise OSM `admin_level=8` (voir 3.1).
- **Licence** : **CC BY 3.0 IGO**. Source : Government of Senegal, OCHA ROWCA. Année représentée : 2019. Construit le 12/12/2023.
- **Attribution à afficher** : `Limites administratives : geoBoundaries (Runfola et al. 2020), d'après Gouvernement du Sénégal / OCHA ROWCA — CC BY 3.0 IGO`.
- **Limites** : aucune clé. Fichiers statiques à télécharger une fois et garder en cache global.
- **Méthode d'accès testée** :
  - `GET https://www.geoboundaries.org/api/current/gbOpen/SEN/ADM3/` renvoie du JSON avec `gjDownloadURL`, `simplifiedGeometryGeoJSON`, `tjDownloadURL`, `staticDownloadLink`, `boundaryLicense` et `admUnitCount`.
  - URL renvoyées (commit `9469f09`) : `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SEN/ADM3/geoBoundaries-SEN-ADM3_simplified.geojson`. Elles **redirigent vers `media.githubusercontent.com`**, car les fichiers sont dans Git LFS. `raw.githubusercontent.com` et jsDelivr ne renvoient que le **pointeur LFS** de 131 octets : ne les utilise pas.
  - URL directe testée : `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/SEN/<ADMn>/geoBoundaries-SEN-<ADMn>[_simplified].geojson`.
  - Tailles : ADM1 1,12 Mo (simplifié : 239 Ko) ; ADM2 1,95 Mo (425 Ko) ; ADM3 2,30 Mo (618 Ko).
  - Propriétés : `shapeName`, `shapeISO` (seulement pour ADM1, par exemple `SN-DK`), `shapeID`, `shapeGroup`, `shapeType`.
  - Code conseillé : appeler l'API, suivre les redirections de `gjDownloadURL` (curl `-L`, fetch `redirect: 'follow'`) et vérifier que la réponse commence par `{`.
- **Résultat du test ici** : ✅ API et media.githubusercontent.com. `github.com` est bloqué par la politique de ce bac à sable (403 du proxy), ce qui ne pose pas de problème sur le Mac.

### 3.5a Relief : AWS Terrain Tiles (Terrarium)

- **Apporte** : MNT tuilé en PNG RGB pour le relief MapLibre (`raster-dem` avec `encoding: "terrarium"`), l'ombrage et les courbes (par exemple avec `maplibre-contour`).
- **Résolution réelle au Sénégal** : sources SRTM (environ 30 m) sur les terres et ETOPO1 en mer, pas de NED ni de 3DEP. Les tuiles existent **jusqu'à z15** (z16 renvoie 404). Au-delà de z12, c'est un suréchantillonnage.
- **Licence** : domaine public (USGS, NOAA), avec crédits demandés.
- **Attribution à afficher** : `Terrain Tiles (Mapzen/Tilezen, AWS Open Data) — SRTM et GMTED2010 : U.S. Geological Survey ; ETOPO1 : NOAA`.
- **Limites** : aucune clé, bucket AWS public. Pas de quota publié : reste raisonnable et garde en cache par site.
- **Méthode d'accès testée** :
  - `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` : ✅ (z12 : 41 Ko ; z15 : 63 Ko). Variante : `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png`.
  - Décodage : `élévation = R*256 + G + B/256 - 32768`. Exemple z15 : de -7,7 à 36,5 m sur le Plateau, ce qui est plausible.
  - GeoTIFF disponible aussi : `…/geotiff/{z}/{x}/{y}.tif` (82 Ko à z12).

### 3.5b Relief : Copernicus DEM GLO-30 (COG sur AWS)

- **Apporte** : modèle à 1 seconde d'arc (environ 30 m), en float32. Il sert pour les profils, les courbes et les statistiques. ⚠️ C'est un **MNS** (surface, qui inclut le bâti et la végétation), pas un MNT.
- **Licence** : licence Copernicus DEM, gratuite pour le grand public, réutilisation et diffusion permises. L'avis de source est obligatoire.
- **Attribution à afficher** :
  - données non modifiées : `© DLR e.V. 2010-2014 et © Airbus Defence and Space GmbH 2014-2018, fourni dans le cadre de COPERNICUS par l'Union européenne et l'ESA ; tous droits réservés` ;
  - produits dérivés (courbes, ombrages) : `produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved`.
- **Limites** : aucune clé. Pas de tuile en mer : l'altitude y vaut 0.
- **Méthode d'accès testée** :
  - Nom de tuile par coin sud-ouest, `floor(lat)` et `floor(lon)` : `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N14_00_W018_00_DEM/Copernicus_DSM_COG_10_N14_00_W018_00_DEM.tif`.
    - Dakar : N14 W018, 6,1 Mo, presque toute en mer.
    - Fatick : N14 W017, 47,7 Mo.
  - Format : EPSG:4326, 3600 × 3600, deflate, blocs de 1024, aperçus ×2, ×4 et ×8. Lecture partielle de 0,01° en 1,0 s : de 1,1 à 16,5 m, plausible.

### 3.6a WorldPop (population 100 m, R2025A)

- **Apporte** : nombre de personnes par pixel de 3 secondes d'arc (environ 100 m), version **R2025A v1** « constrained » (limitée aux zones bâties), années **2015 à 2030**. Pour 2026, le total Sénégal fait 19,15 M. Sur la Médina, environ 167 habitants par pixel d'environ 1 ha.
- **Licence** : CC BY 4.0. Le GeoTIFF porte la balise `TIFFTAG_COPYRIGHT = CC-BY-4.0`.
- **Attribution à afficher** : `Population : WorldPop (www.worldpop.org), R2025A v1, DOI 10.5258/SOTON/WP00839 — CC BY 4.0`.
- **Limites** : aucune clé. **Le serveur `data.worldpop.org` ne gère pas les requêtes HTTP Range** : télécharge le fichier entier une fois et garde-le en cache global.
- **Méthode d'accès testée** :
  - Catalogue : `GET https://hub.worldpop.org/rest/data/pop/G2_CN_POP_R25A_100m?iso3=SEN` renvoie 16 entrées (une par année), avec `files[0]`.
  - Fichier 2026 : `https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2026/SEN/v1/100m/constrained/sen_pop_2026_CN_100m_R2025A_v1.tif`. **17,5 Mo**, téléchargé en 6,7 s. Format : EPSG:4326, 7422 × 5264 px, float32, nodata -99999, LZW, blocs de 512.
  - Motif : `…/R2025A/<année>/SEN/v1/100m/constrained/sen_pop_<année>_CN_100m_R2025A_v1.tif`.
  - Population d'une zone = somme des pixels dans le polygone, pondérée par la fraction de recouvrement si possible.

### 3.6b GHSL : GHS-POP et GHS-BUILT-S (R2023A)

- **Apporte** :
  - GHS-BUILT-S : surface bâtie en m² par cellule de 100 m (uint16, de 0 à 10 000) ;
  - GHS-POP : habitants par cellule (float64) ;
  - époques de 1975 à 2030, avec **2025** conseillée ;
  - en option, GHS-BUILT-H (hauteur moyenne 2018, 100 m) et GHS-BUILT-S NRES (bâti non résidentiel).
- **Licence** : CC BY 4.0, © Union européenne 1995-2026 (`copyright.txt` du serveur).
- **Attribution à afficher** : `GHSL – Global Human Settlement Layer, Commission européenne, Centre commun de recherche (JRC), GHS-BUILT-S / GHS-POP R2023A — CC BY 4.0`.
- **Limites** : aucune clé. Tuiles zip de 10° × 10°.
- **Méthode d'accès testée** :
  - Grille en EPSG:4326 à 3 secondes d'arc : `R = floor((89.09958 - lat)/10) + 1`, `C = floor((lon + 180.00792)/10) + 1`. **Dakar et Fatick sont dans `R8_C17`** (bornes -20,008 / 9,100 / -10,008 / 19,100).
  - BUILT-S 2025 : `https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A/GHS_BUILT_S_E2025_GLOBE_R2023A_4326_3ss/V1-0/tiles/GHS_BUILT_S_E2025_GLOBE_R2023A_4326_3ss_V1_0_R8_C17.zip` (**11,1 Mo**).
  - POP 2025 : `https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/GHS_POP_E2025_GLOBE_R2023A_4326_3ss/V1-0/tiles/GHS_POP_E2025_GLOBE_R2023A_4326_3ss_V1_0_R8_C17.zip` (**39,7 Mo**).
  - Le zip contient `<même nom>.tif`, plus un PDF et un XLSX. GDAL peut le lire sur place : `/vsizip/<zip>/<nom>.tif`. Sinon, il faut le décompresser. Format : 12 000 × 12 000 px, LZW, blocs de 256.
  - Test Médina (0,01°²) : bâti de 1543 à 5102 m² par cellule ; population de 92 à 430 habitants par cellule.
  - D'autres versions existent (`GHS_WUP_POP_GLOBE_R2025A`, seulement à 1 km) : non retenues pour l'échelle du site.

### 3.7 JRC Global Surface Water

- **Apporte** : occurrence de l'eau de 1984 à 2021 (% du temps), changement, saisonnalité, récurrence, transitions. Utile pour les zones inondables (Niayes, lacs Retba et Mbeubeusse, Pikine, Fatick et le Sine-Saloum).
- **Licence** : CC BY 4.0, © UE (Copernicus). « Fourni gratuitement, sans restriction d'usage. »
- **Attribution à afficher (sur carte)** : `Source: EC JRC/Google`. Dans les rendus, ajoute la citation de Pekel et al. (2016), *Nature* 540, 418–422.
- **Limites** : aucune clé. Les tuiles XYZ sont des images RGB pour l'affichage, **pas pour l'analyse**.
- **Méthode d'accès testée** :
  - Tuiles v1.4 (2021) : `https://storage.googleapis.com/global-surface-water/tiles2021/{layer}/{z}/{x}/{y}.png`, avec `layer` parmi `occurrence|change|seasonality|recurrence|transitions`. ✅ jusqu'à **z13** (z14 renvoie 404). `extent` renvoie 404.
  - Tuiles 2024, plus récentes (citées sur la page officielle) : `https://storage.googleapis.com/water-world/tiles2024/{layer}/{z}/{x}/{y}.png`. ✅ pour occurrence, change, recurrence, seasonality et transitions jusqu'à z13.
  - GeoTIFF pour l'analyse : `https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/occurrence_20W_20Nv1_4_2021.tif`. Le nom vient du coin **nord-ouest** de la tuile de 10° : Dakar et Fatick sont dans `20W_20N`. Le fichier fait 31,9 Mo (uint8, en %, de 0 à 100), en TIFF tuilé à blocs de 256 et lisible par plage d'octets (0,01° lu en 1,0 s). Même motif pour `change`, `seasonality`, `recurrence`, `transitions`, `extent`.
  - Miroir JRC (`jeodpp…/GSWE/Aggregated/LATEST/occurrence/tiles/occurrence-0000000000-0000040000.tif`) : nommé par décalage de pixels, moins pratique.

### 3.8a Sentinel-2 L2A : Microsoft Planetary Computer

- **Apporte** : images à 10 m récentes, filtrées sur les nuages, à plusieurs dates. Le rendu PNG du site sert de fond de carte. Dakar est à cheval sur deux tuiles MGRS, **27PZS et 28PBB** : choisis l'item qui couvre tout le site, ou fais une mosaïque.
- **Licence des données** : données Copernicus Sentinel, libres et gratuites, usage commercial compris, avec attribution. Service régi par les conditions d'utilisation du Planetary Computer.
- **Attribution à afficher** : `Contient des données Copernicus Sentinel modifiées [année], traitées via Microsoft Planetary Computer`.
- **Limites** : pas de clé. Accès anonyme limité en débit, sans chiffre publié. Les jetons SAS durent environ 45 à 60 min. Garde en cache le PNG ou le GeoTIFF de chaque site et date.
- **Méthode d'accès testée** :
  1. Recherche (0,7 s, 5 résultats) :
     ```
     POST https://planetarycomputer.microsoft.com/api/stac/v1/search
     {"collections":["sentinel-2-l2a"],"bbox":[-17.46,14.66,-17.43,14.69],
      "datetime":"2026-06-01T00:00:00Z/2026-11-04T00:00:00Z",
      "query":{"eo:cloud_cover":{"lt":10}},
      "sortby":[{"field":"properties.datetime","direction":"desc"}],"limit":5}
     ```
     Le premier résultat est `S2A_MSIL2A_20261030T113321_R080_T27PZS_20261030T193706` (8 % de nuages). Vient ensuite `S2B_MSIL2A_20261013T113319_R080_T28PBB_20261013T154950` (0,09 % de nuages).

     Assets : `B01…B12`, `B8A`, `SCL` (masque de scène, pour mesurer les nuages sur le site lui-même), `visual` (TCI 10 m), `tilejson`, `rendered_preview`.
  2. **Rendu PNG d'une bbox** (✅ 200, 1024 × 1024 RGBA, 439 Ko, 1,9 s ; image vérifiée à l'œil : Plateau, Médina, port et corniche, bien orientés) :
     ```
     https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-17.46,14.66,-17.43,14.69/1024x1024.png?collection=sentinel-2-l2a&item=S2B_MSIL2A_20261013T113319_R080_T28PBB_20261013T154950&assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0
     ```
     Variante sur bandes brutes : `&assets=B04&assets=B03&assets=B02&rescale=0,3000` (✅).

     Calcule la largeur et la hauteur selon le rapport réel de l'emprise. L'image sort en EPSG:4326 : un format 1024 × 1024 sur 0,03° × 0,03° déforme d'environ 3 % à cette latitude. Pour caler l'image dans MapLibre, utilise une source `image` avec les 4 coins de la bbox.
  3. **Tuiles XYZ** : `GET https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=sentinel-2-l2a&item=<id>&assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0` renvoie `tiles: ["https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?…"]`.
  4. **Signature** pour lire les COG directement : `GET https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a` renvoie `{"token":"st=…&se=…&sig=…","msft:expiry":…}`. Ajoute `?<token>` à `assets.*.href` (blob `sentinel2l2a01.blob.core.windows.net`).

### 3.8b Sentinel-2 : Copernicus Data Space (repli)

- `POST https://stac.dataspace.copernicus.eu/v1/search` (même corps de requête, sans `query`) : ✅ résultats, par exemple `S2B_MSIL2A_20261102T113319_N0513_R080_T28PBB…` (70 % de nuages).
- Les assets (`TCI_10m`, etc.) sont en `s3://eodata/…` ou en HTTPS, et **demandent un compte gratuit** (jeton OAuth ou clés S3).
- **Verdict** : repli seulement si l'utilisateur renseigne `CDSE_USERNAME` et `CDSE_PASSWORD`. Fonction désactivée sinon.

### 3.9a Fonds de carte : OpenFreeMap

- **Styles** (✅ 200) : `https://tiles.openfreemap.org/styles/liberty`, `…/positron` (clair), `…/dark`, `…/bright`, `…/fiord`. Ce sont des styles MapLibre complets, à passer tels quels à `new maplibregl.Map({style})`.
- **Tuiles** : `https://tiles.openfreemap.org/planet` (TileJSON, maxzoom 14) pointe vers `https://tiles.openfreemap.org/planet/20261101_080013_pt/{z}/{x}/{y}.pbf`. Le chemin daté change : passe toujours par le TileJSON. Tuile z14 sur Dakar : ✅ 136 Ko.
- **Glyphes** : `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`, polices `Noto Sans Regular|Bold|Italic` (✅). Sprites : `https://tiles.openfreemap.org/sprites/ofm_f384/ofm`.
- **Fond « papier »** : pars de `positron` et retire les couches `symbol`, ou fais un style maison sur la source `openmaptiles`.
- **Licence et attribution** (champ `attribution` du TileJSON) : `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`. Affiche : `© OpenFreeMap, © OpenMapTiles, © les contributeurs d'OpenStreetMap`.
- **Conditions** : pas de clé, pas de limite d'affichage publiée, service fourni sans garantie.
  - Téléchargement hors ligne permis : au plus **3000 tuiles ou 50 Mo** par téléchargement, 4 requêtes en parallèle et un User-Agent unique.
  - Les exports haute résolution sont donc possibles, dans ces limites. C'est **le fond à utiliser pour les exports PNG et PDF**.

### 3.9b Fonds de carte : Protomaps (optionnel)

- API `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=…` : 403 sans clé. La clé est gratuite pour un usage non commercial.
- Sans clé : les builds quotidiens `https://build.protomaps.com/20261104.pmtiles` (139 Go, liste dans `https://build-metadata.protomaps.dev/builds.json`) se lisent par plage d'octets (✅ 206, en-tête `PMTiles`). On en extrait le Sénégal une fois avec la CLI `pmtiles extract https://build.protomaps.com/<date>.pmtiles senegal.pmtiles --bbox=-17.6,12.3,-11.3,16.7`, puis on le sert en local avec le protocole `pmtiles://` de MapLibre. Polices : `https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf` (✅).
- Attribution : `Protomaps © les contributeurs d'OpenStreetMap`.
- **Verdict** : facultatif, car OpenFreeMap couvre déjà le besoin. Utile pour un fonctionnement totalement hors ligne.

### 3.9c Fonds de carte : tuiles OSM standard

- `https://tile.openstreetmap.org/{z}/{x}/{y}.png` : ✅ 200, 30 Ko.
- **Politique OSMF** :
  - attribution visible `© les contributeurs d'OpenStreetMap` ;
  - User-Agent identifiant ;
  - Referer valide pour le web ;
  - respect des en-têtes de cache (au moins 7 jours) ;
  - **interdits** : préchargement, téléchargement de masse, usage hors ligne, archives de tuiles.
- **Verdict** : fond **à l'écran uniquement**, pour la navigation interactive. Pour les exports 300 dpi en A1 ou A0, qui demandent des milliers de tuiles à fort zoom, utilise OpenFreeMap (style vectoriel `bright` ou `liberty`). Dans le projet QGIS exporté, une couche XYZ vers tile.openstreetmap.org est acceptable : QGIS charge lui-même les tuiles, en interactif.

### 3.9d Imagerie haute résolution : Esri World Imagery (optionnel, avec clé)

- Ancien point d'accès **sans clé**, qui fonctionne techniquement : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. ⚠️ L'ordre est **{y}/{x}**. Test : ✅ 200 JPEG de 23 Ko à z17 sur Dakar ; 24 niveaux.
- **Conditions vérifiées** : le champ `licenseInfo` de l'item ArcGIS `10df2279f9684e4a9f6a7f08febac2a9` dit « This work is licensed under the Esri Master License Agreement ».
  - Il **n'est pas prévu pour l'export de tuiles hors ligne**. Esri renvoie pour cela vers la couche « World Imagery (for Export) », réservée aux applications ArcGIS.
  - La documentation Esri exige un **compte ArcGIS (Location Platform ou Online)** et une clé d'API pour les services de fond de carte. Elle exige aussi d'afficher « Powered by Esri » et la source. L'ancien point d'accès est déclaré non maintenu et peut être coupé sans préavis.
- **Attribution** (`copyrightText` du service) : `Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community`, plus `Powered by Esri`.
- **Verdict** : utilisation **sans clé non retenue**, car les conditions ne l'autorisent pas clairement. Intégration **optionnelle** si `ARCGIS_API_KEY` est renseignée (compte ArcGIS Location Platform, palier gratuit), via `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=<clé>`. Ce point d'accès n'a pas pu être testé ici faute de clé. Pas de mise en cache sur disque. Les exports de mise en page restent possibles, avec l'attribution affichée.

### 3.9e Imagerie : EOxCloudless (ex-s2cloudless) ⚠️ NC

- WMTS sans clé : `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg`. ⚠️ L'ordre est {y}/{x}. ✅ z14 et z17 sur Dakar. Couches disponibles d'après `WMTSCapabilities.xml` : `s2cloudless-2017` à **`s2cloudless-2025`**, chacune avec une variante `_3857`.
- **Licence** : CC BY-NC-SA 4.0 pour l'usage **non commercial**. L'usage commercial demande une licence EOX.
- **Attribution** : `EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)`.
- **Verdict** : mosaïque à 10 m sans nuages, belle à petite échelle. À n'activer que pour un usage strictement personnel et non commercial. Elle ne remplace pas une imagerie haute résolution.

### 3.10a Géocodage : Nominatim (OSMF)

- `GET https://nominatim.openstreetmap.org/search?q=M%C3%A9dina%2C%20Dakar&format=jsonv2&countrycodes=sn&limit=5&accept-language=fr` renvoie « Commune de Médina, Arrondissement de Dakar-Plateau… », avec `boundingbox` et `osm_id`. Ajoute `&polygon_geojson=1` pour récupérer le contour, ce qui sert directement à créer un site.
- **Politique** : **1 requête par seconde au maximum**, User-Agent identifiant (pas celui d'une bibliothèque), **cache obligatoire**, **autocomplétion interdite**, attribution `© les contributeurs d'OpenStreetMap`.
- **Implémentation** : recherche lancée sur validation (touche Entrée) et non à la frappe, file d'attente d'1 requête par seconde côté serveur, cache des réponses dans `data/cache/geocode.json`.
- **Test ici** : ✅. Un premier essai avec un User-Agent contenant `test@example.org` a reçu un **403** « Access denied ».

### 3.10b Géocodage : Photon (komoot)

- `GET https://photon.komoot.io/api/?q=Yoff&lat=14.7&lon=-17.45&limit=5&lang=fr` renvoie du GeoJSON (Yoff, relation 12988608, `extent`). ✅
- Usage équitable : un usage intensif est bridé, sans garantie de service. L'**autocomplétion est permise**. Attribution : `© les contributeurs d'OpenStreetMap`. Pas de clé.
- **Verdict** : à utiliser pour les suggestions à la frappe (avec un délai d'attente d'au moins 300 ms). Nominatim sert pour la validation et les contours.

### 3.11a Isochrones : Valhalla FOSSGIS (sans clé, par défaut)

- `GET https://valhalla1.openstreetmap.de/isochrone?json=<urlencodé>` avec :
  ```json
  {"locations":[{"lat":14.68,"lon":-17.445}],"costing":"pedestrian",
   "contours":[{"time":5},{"time":10},{"time":15}],"polygons":true,"denoise":0.5,"generalize":20}
  ```
  ✅ 200 en 0,46 s : FeatureCollection de 3 polygones, avec la propriété `contour` (15, 10, 5 min). Testé aussi en `bicycle` (0,7 s) et en `auto` (0,5 s). On peut aussi passer `{"distance": km}` dans `contours`.
- **Conditions FOSSGIS** (qui couvrent aussi `routing.openstreetmap.de` et `overpass-api.de`) :
  - **1 requête par seconde au maximum** ;
  - User-Agent identifiant ;
  - Referer si possible ;
  - au plus 2 connexions (1 pour un script) ;
  - téléchargement de masse interdit ;
  - usage commercial seulement s'il reste non substantiel ;
  - service révocable à tout moment ;
  - URL de préférence configurable plutôt qu'écrite en dur.
- **Attribution** : `Données © les contributeurs d'OpenStreetMap (ODbL) — calcul Valhalla, serveur FOSSGIS e.V.`, avec un lien vers https://www.openstreetmap.org/fixthemap.
- **Verdict** : conforme pour un usage personnel ponctuel. URL dans `.env` (`VALHALLA_URL`, avec cette valeur par défaut).

### 3.11b Isochrones : OpenRouteService (si clé)

- `POST https://api.openrouteservice.org/v2/isochrones/{foot-walking|cycling-regular|driving-car}`, en-tête `Authorization: <clé>`, corps `{"locations":[[lon,lat]],"range":[300,600,900],"range_type":"time"}`. ⚠️ L'ordre est **lon,lat**.
- Sans clé : 401, comportement attendu. Clé gratuite sur https://openrouteservice.org/dev/#/signup.
- Quotas du plan Standard gratuit : **500 isochrones par jour et 20 par minute** (d'après la page des offres et le forum ORS, à revérifier à l'inscription). Portée max 1 h, 5 points par requête.
- **Attribution** : `© openrouteservice.org by HeiGIT | Données © les contributeurs d'OpenStreetMap`.

### 3.12 Source supplémentaire : ESA WorldCover 10 m (v200, 2021)

- **Apporte** : occupation du sol à 10 m en 11 classes : 10 arbres, 20 arbustes, 30 prairie, 40 cultures, 50 bâti, 60 sol nu, 80 eau permanente, 90 zones humides herbacées, **95 mangroves** (utile pour Fatick et le Saloum), etc. Elle sert à estimer la part d'espaces verts et d'eau quand OSM est lacunaire.
- **Licence** : CC BY 4.0, inscrite dans les métadonnées du fichier.
- **Attribution à afficher** : `ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium`. C'est la balise `copyright` du fichier, CC BY 4.0.
- **Accès testé** : tuile de 3° nommée par son coin sud-ouest, `N{floor(lat/3)*3}W{…}`. Dakar et Fatick : `N12W018`.
  - URL : `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N12W018_Map.tif` (80 Mo).
  - COG uint8 avec aperçus (×2 à ×64), blocs de 1024.
  - Lecture partielle de la bbox de test en 0,9 s : 50 bâti = 88 080 px, 80 eau = 36 036 px (océan), 30 prairie = 1257, etc. C'est plausible.
- Pas de clé.

---

## 4. Sources exclues ou non retenues (et pourquoi)

| Source | Raison |
|---|---|
| **Esri World Imagery sans clé** (`server.arcgisonline.com`) | Fonctionne techniquement, mais les conditions (Esri Master License Agreement, compte ArcGIS requis pour les fonds hors ArcGIS, pas d'export hors ligne) ne couvrent pas clairement un usage anonyme. Retenue seulement **avec** une clé ArcGIS (§ 3.9d). |
| **Google Maps / Google Satellite** (tuiles `mt*.google.com`) | Interdit par les conditions de Google Maps Platform hors de son API officielle (clé et facturation). L'API OSM met d'ailleurs `*.google(apis)` sur liste noire comme source d'imagerie. |
| **Bing Maps Aerial** | Clé requise ; service Bing Maps pour entreprises en fin de vie (remplacé par Azure Maps). Pas de valeur ajoutée sans clé. |
| **Copernicus Data Space sans compte** | Recherche STAC libre, mais téléchargement des images impossible sans compte et jeton. Repli seulement si des identifiants sont fournis (§ 3.8b). |
| **API OSM 0.6 comme source principale** | La politique OSMF la réserve à l'édition. Elle n'est gardée qu'en repli ponctuel (§ 3.1b). |
| **Téléchargement massif de tuiles `tile.openstreetmap.org` (exports et cache hors ligne)** | Interdit par la politique des tuiles OSMF. Fond OSM réservé à l'écran ; exports faits avec OpenFreeMap. |
| **`tile.openstreetmap.de` (FOSSGIS)** | Les conditions FOSSGIS interdisent son usage par une application qui charge les tuiles elle-même sans accord préalable. |
| **Google Open Buildings via Earth Engine** | Demande un compte et un projet Google Cloud ; les mêmes données existent en accès libre (VIDA, GCS). |
| **Microsoft Global ML Building Footprints (accès direct)** | Pas d'intérêt à l'intégrer seul : déjà inclus dans Overture (avec conflation) et dans le fichier VIDA. |
| **geoBoundaries ADM4 / communes** | N'existe pas pour SEN (404). Les communes viennent d'OSM (`admin_level=8`). |
| **HDX COD-AB Sénégal (`cod-ab-sen`)** | Même source et mêmes niveaux que geoBoundaries (Gouvernement du Sénégal / OCHA ROWCA, CC BY-IGO, jusqu'aux arrondissements), en zips de 10 à 24 Mo. Redondant. |
| **WorldPop en lecture partielle** | Impossible (serveur sans HTTP Range). Ce n'est pas une exclusion : téléchargement complet de 17,5 Mo, mis en cache. |
| **GHS-WUP-POP R2025A** | Seulement à 1 km : trop grossier pour un site de quelques km². |
| **EOxCloudless par défaut** | ⚠️ Non commercial (CC BY-NC-SA 4.0). Option désactivée par défaut, car les planches de rendu peuvent avoir un usage professionnel. |
| **Protomaps API** | Clé requise ; OpenFreeMap répond au même besoin sans clé. Variante PMTiles locale facultative. |
| **Instances Overpass `overpass.kumi.systems`, `overpass.private.coffee`, `overpass.osm.jp`** | Non exclues, mais **non vérifiées** : délai dépassé ou erreur de certificat depuis ce bac à sable. Gardées dans la liste de repli. |
| **Extrait Geofabrik `.osm.pbf`** | Injoignable depuis ce bac à sable (pas de conclusion). Repli éventuel pour un usage hors ligne, avec DuckDB `ST_ReadOSM`. |

---

## 5. Variables d'environnement suggérées (`.env.example`)

```
CHUILACARTE_CONTACT=          # email réel, injecté dans le User-Agent (obligatoire pour Nominatim, Overpass, Valhalla)
OVERPASS_URLS=https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.private.coffee/api/interpreter,https://overpass.kumi.systems/api/interpreter
VALHALLA_URL=https://valhalla1.openstreetmap.de
ORS_API_KEY=                  # facultatif : isochrones OpenRouteService
ARCGIS_API_KEY=               # facultatif : Esri World Imagery
CDSE_USERNAME=                # facultatif : Copernicus Data Space
CDSE_PASSWORD=
ENABLE_NONCOMMERCIAL_SOURCES=false   # EOxCloudless
```
