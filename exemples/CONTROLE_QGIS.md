# Contrôle de compatibilité QGIS : site `ui-collecte` (Médina de Dakar)

Contrôle du 04/11/2026, fait sur la version de production (http://localhost:3200). Le site n'a pas été modifié : `/api/import` ne fait que lire.

## Environnement

| Élément | Version |
|---|---|
| OS | Ubuntu 24.04.5 LTS |
| QGIS / PyQGIS | **3.34.4-Prizren** (paquets Ubuntu `qgis`, `python3-qgis`, `qgis-providers` 3.34.4+dfsg-4build2), sans interface, `QT_QPA_PLATFORM=offscreen`, Python 3.12 |
| GDAL / OGR | 3.8.4 |
| ezdxf / pyproj | 1.4.5 / 3.8.0 |

Fichiers contrôlés :
- `POST /api/sites/ui-collecte/qgis` : zip `ui-collecte/` contenant le `.qgs`, le `.gpkg` (893 ko, 10 tables + `layer_styles`), 2 images PNG avec `.pgw` et `.aux.xml`, et `LISEZMOI.txt` ;
- les exports `gpkg` (381 ko, 6 couches), `dxf` (912 ko) et `geojson` (6 fichiers).

Les exports `gpkg`, `dxf` et `geojson` ne contiennent que les **couches visibles**, alors que le dossier QGIS contient toutes les couches (`exportLayers.ts`, ligne 35). C'est voulu.

## 1. Projet `.qgs` ouvert dans PyQGIS

`QgsProject.read()` renvoie `True`, sans erreur. Le projet est en **EPSG:32628**. L'emprise du canevas est 236 064–237 084 / 1 623 403–1 624 373 m.

| # | Couche (ordre de l'arbre, du dessus vers le dessous) | Valide | SCR | Objets QGIS / GPKG | Rendu |
|---|---|---|---|---|---|
| 1 | Annotations | oui | 32628 | 17 / 17 | singleSymbol (marqueur rouge, couleur définie par le champ `couleur`), étiquettes sur `texte` |
| 2 | Emprise du site | oui | 32628 | 1 / 1 | singleSymbol : contour rouge en tirets et **hachures à 45° (LinePatternFill)** |
| 3 | Zone tampon (300 m) | oui | 32628 | 1 / 1 | singleSymbol, contour en pointillés |
| 4 | Lieux (Overture) (masquée) | oui | 32628 | 140 / 140 | singleSymbol |
| 5 | Courbes de niveau (2 m) | oui | 32628 | 9 / 9 | singleSymbol, brun |
| 6 | Réseau routier (Overture) | oui | 32628 | 288 / 288 | **categorizedSymbol** sur `classe` : primaire, secondaire, tertiaire, desserte, piéton, autre, « Autres ». Valeurs présentes dans les données : desserte, piéton, primaire, secondaire, tertiaire |
| 7 | Bâtiments détectés (Google Open Buildings) | oui | 32628 | 870 / 870 | **graduatedSymbol** sur `surface_m2`, 5 classes Oranges (5,4 → 3 961,2) |
| 8 | Bâtiments (Overture) (masquée) | oui | 32628 | 1707 / 1707 | singleSymbol, gris |
| 9 | Limites administratives (masquée) | oui | 32628 | 3 / 3 | singleSymbol, tirets |
| 10 | Population 2026 (WorldPop) (masquée) | oui | 32628 | 90 / 90 | **singleSymbol gris** au lieu des classes graduées (défaut n° 4) |
| 11-12 | Eau JRC, occurrence et changement (XYZ, masquées) | oui | 3857 | – | singlebandcolordata |
| 13 | Sentinel-2 du 23/10/2026 | oui | **4326** | 256 × 256 px | multibandcolor RGBA. Emprise lon −17,45029 → −17,44171, lat 14,67180 → 14,67970 |
| 14 | Occupation du sol 2021 (ESA WorldCover) | oui | **4326** | 104 × 96 px | multibandcolor. Emprise lon −17,45033 → −17,44167, lat 14,67175 → 14,67975 |
| 15 | Fond : Vectoriel clair (XYZ OSM) | **absent de l'arbre** | 3857 | – | voir le défaut n° 1 |

Résultats :
- **14 couches sur 15 chargent** et sont valides. Les nombres d'objets sont identiques à ceux du GeoPackage.
- Les SCR sont tous corrects : 32628 pour les vecteurs, 4326 pour les images, 3857 pour les XYZ.
- L'ordre des couches est cohérent : annotations et emprise au-dessus, puis voirie, puis bâti au-dessus de la population et des images. Le fond devrait être en bas, mais il n'apparaît pas (défaut n° 1).
- Les images sont bien calées : la trame des rues se superpose exactement aux îlots de Sentinel-2, et la mer de WorldCover apparaît au sud-ouest, comme sur le terrain. La légère rotation des images dans le plan UTM est normale (convergence des méridiens).

Rendus (`QgsMapRendererParallelJob`, 1400 × 1300 px, 120 dpi) :
- `exemples/qgis/rendu_projet.png` : les couches visibles du projet (le fond XYZ n'est pas rendu).
- `exemples/qgis/rendu_toutes_couches.png` : tous les vecteurs, couches masquées comprises. La population y apparaît en aplat gris uniforme.
- `exemples/qgis/rendu_annotations_zoom.png` : zoom sur les annotations. Seuls 3 points rouges s'affichent, sans aucun texte ni forme.
- `exemples/qgis/rendu_sentinel2-2026-10-23.png` et `exemples/qgis/rendu_worldcover-2021.png` : calage des images sous la voirie et l'emprise.

Appréciation visuelle : le rendu donne une carte d'urbanisme propre et lisible. Les voies sont hiérarchisées par épaisseur et par teinte, le bâti est rendu en camaïeu orangé, les courbes sont fines et l'emprise est hachurée en rouge. Il reste trois manques visibles : les annotations sont réduites à 3 points, sans texte ni forme ; seules 2 teintes de bâti sur 5 sont utilisées ; et il n'y a pas de fond de plan.

## 2. GeoPackage ouvert seul

`QgsVectorLayer(gpkg|layername=…)` a été testé sur les deux GeoPackages : celui du dossier QGIS et celui de `/export`.
- Toutes les couches sont valides, en EPSG:32628. `gpkg_contents` et `gpkg_geometry_columns` sont cohérents.
- **Le style par défaut de `layer_styles` est appliqué dès l'ouverture**, sans appel à `loadDefaultStyle()` : la voirie arrive en catégories, le bâti en classes graduées, l'emprise avec ses hachures. `loadDefaultStyle()` renvoie `True`.
- La table `layer_styles` a le schéma standard de QGIS. `styleSLD` est vide, ce qui est sans conséquence.
- `qgis:checkvalidity` (QGIS 3.34 ne propose pas `native:checkvalidity`), méthodes GEOS et QGIS :
  - **0 géométrie invalide** pour les bâtiments Google (870), les bâtiments Overture (1707), la population (90), l'emprise, la zone tampon et les limites administratives ;
  - pour les annotations, **1 erreur avec la méthode QGIS** : le croquis contient 2 sommets consécutifs en double (`line 1 contains 2 duplicate node(s) starting at vertex 1`).

## 3. DXF (`ezdxf` et OGR)

- `ezdxf.readfile` réussit (version AC1009 / R12). `ezdxf.recover` et `audit()` signalent **0 erreur et 0 correction**. `ogrinfo` ouvre le fichier sans erreur (1294 entités).
- Calques : `0`, `Annotations`, `Emprise_du_site`, `Zone_tampon_300_m_`, `Courbes_de_niveau_2_m_`, `Reseau_routier_Overture_`, `Batiments_detectes_Google_Open_` et `Defpoints`.
- Entités :

  | Calque | Entités |
  |---|---|
  | Annotations | 11 POLYLINE et 6 TEXT |
  | Bâtiments (Google) | 870 POLYLINE, toutes fermées |
  | Courbes | 117 POLYLINE (les 9 multilignes éclatées) |
  | Voirie | 288 |
  | Emprise | 1 |
  | Tampon | 1 |

- Coordonnées : X de 235 961,6 à 237 190,7 et Y de 1 623 063,7 à 1 624 472,2. On est bien **en mètres UTM 28N**. `$INSUNITS` vaut 6 (mètres).
- Contrôle de distance sur le premier côté de l'emprise :

  | Mesure | Longueur |
  |---|---|
  | Dans le DXF | **323,283 m** |
  | Recalculée avec pyproj depuis le GeoJSON WGS84 (projection 32628) | **323,282 m** |
  | Géodésique sur l'ellipsoïde | 323,134 m |

  L'écart maximal entre un sommet du DXF et le même sommet reprojeté avec pyproj est de **0,6 mm**. L'écart de 0,05 % avec la géodésique correspond au facteur d'échelle UTM à 2,45° du méridien central : c'est normal.
- Le DXF réimporté avec `/api/import` revient en WGS84 au bon endroit (lon −17,443, lat 14,679).

## 4. Aller-retour QGIS → Chuilacarte

Modifications faites dans PyQGIS sur une copie du GeoPackage :
- ajout d'un bâtiment rectangulaire de 20 × 10 m dans `batiments_overture`, centré sur lon −17,4460, lat 14,6760 (soit E 236 574,74, N 1 623 915,87) ;
- écriture d'une nouvelle couche `points_test_qgis` en EPSG:32628 avec `QgsVectorFileWriter`, contenant 3 points ;
- même couche enregistrée dans un GeoPackage à part.

Résultats de `/api/import` :
- Les 13 couches sont relues. La couche d'annotations mixte est découpée en « annotations (points / lignes / polygones) », et `layer_styles` n'est pas importée comme couche, ce qui est correct.
- `batiments_overture` passe à **1708** objets. Le centroïde du bâtiment ajouté revient à (−17,446000, 14,676000) : **écart de 0,0 m**. Les côtés mesurent 19,991 × 9,995 m (géodésique). Il n'y a ni inversion lat/lon ni décalage.
- Les points de test reviennent à (−17,443 ; 14,679), (−17,450 ; 14,672) et (−17,446 ; 14,676) : les valeurs saisies, à 1e-15 près.
- L'emprise réimportée est identique à l'export GeoJSON (écart de 1,8e-14°).

## Défauts constatés

| n° | Gravité | Défaut |
|---|---|---|
| 1 | Important | Le fond XYZ est absent de l'arbre des couches |
| 2 | Important | Les lignes et polygones d'annotations sont invisibles |
| 3 | Important | Aucune étiquette ne s'affiche dans QGIS |
| 4 | Important | La population n'a pas de classes graduées |
| 5 | Important | Les accents sont illisibles dans le DXF |
| 6 | Important | Les courbes de niveau du DXF sont à Z = 0 |
| 7 | Mineur | Seules 2 classes graduées de bâti sur 5 sont utilisées |
| 8 | Mineur | Les repères numérotés n'ont pas d'étiquette |
| 9 | Mineur | Les styles de trait sont perdus dans le DXF |
| 10 | Mineur | Le croquis contient un sommet en double |
| 11 | Mineur | `source` est doublement échappé dans `<layer-tree-layer>` |
| 12 | Mineur | L'attribution du fond ne correspond pas aux tuiles |
| 13 | Mineur | WorldCover est rééchantillonné en bilinéaire |
| 14 | Mineur | La police Inter est imposée aux étiquettes |
| 15 | Mineur | Noms des couches importées et type de `fid` |

Aucun défaut n'est **bloquant** : le projet s'ouvre, toutes les données sont présentes, bien projetées et bien placées.

### 1. Important : le fond XYZ est absent de l'arbre des couches

**Preuve.** La couche est enregistrée par QGIS sous un identifiant aléatoire (`_eb3eee4d_…`). Le nœud `<layer-tree-layer id="fond_e">` reste orphelin : l'arbre compte 14 nœuds résolus sur 15. Dans QGIS bureau, le fond n'apparaît donc pas et n'est pas dessiné.

**Cause.** `QgsMapLayer::readLayerXml` n'accepte un `<id>` que s'il dépasse **10 caractères**. Or `mkId('fond')` produit `fond_e`, soit 6 caractères (`lib/server/qgisProject.ts`, ligne 162). Toute couche au nom court (par exemple « Bâti » → `bati_3`) aurait le même problème.

**Correction suggérée.** Générer des identifiants d'au moins 11 caractères, par exemple `${slug}_${n}_${uuid court}` ou un préfixe fixe `chuilacarte_…`. Vérifié : en renommant l'identifiant en `fond_de_carte_e`, les 15 nœuds sur 15 sont résolus.

### 2. Important : les lignes et polygones d'annotations sont invisibles

**Preuve.**
- La table `annotations` est de type `GEOMETRY` et contient 6 points, 5 lignes et 6 polygones. QGIS la charge en **Point**, à partir du premier objet. Le symbole est un marqueur : flèches, cotations, rectangles, cercles, polygones et croquis ne sont pas dessinés.
- Même chose avec le GeoPackage ouvert seul : les sous-couches `geometrytype=LineString` et `geometrytype=Polygon` reçoivent le style par défaut (un marqueur), et leur rendu donne 0 pixel non blanc.

**Cause.** La table est en géométrie mixte, avec un seul style de marqueur (`QGIS_GEOM.GEOMETRY = 'Unknown'`, `kindOf()` dans `lib/server/qgis.ts`).

**Correction suggérée.**
- Écrire trois tables dans le GeoPackage : `annotations_points`, `annotations_lignes` et `annotations_polygones`, chacune avec son style (marqueur, ligne, remplissage à 15 %).
- Ou bien, au minimum, dans le `.qgs`, déclarer trois `<maplayer>` avec `|layername=annotations|geometrytype=Point` (puis `LineString` et `Polygon`), chacune avec le symbole adapté.

### 3. Important : aucune étiquette ne s'affiche dans QGIS

**Preuve.** Les étiquettes sont activées sur `texte`, et 2 objets ont un texte (« Marché central »). Pourtant `takeLabelingResults()` renvoie **0 étiquette**. Avec la même configuration et `priority=5`, les 2 étiquettes sont placées.

**Cause.** La balise `<placement>` n'a **pas d'attribut `priority`**. QGIS lit alors `priority=0`, la priorité la plus basse, et PAL écarte les étiquettes.

**Correction suggérée.** Ajouter `priority="5"` dans la balise `<placement>` (`labelingXml`, `lib/server/qgis.ts`, ligne 98). C'est vérifié sur une copie du projet. Ajouter aussi, par précaution, `<text-format>`/`zIndex="0"`, `<rendering ... drawLabels="1" maxNumLabels="2000">`.

### 4. Important : la population n'a pas de classes graduées

**Preuve.** Dans Chuilacarte, la couche est en mode `graduated` sur le champ `population`, mais avec `classes: []`. Le projet contient donc un `singleSymbol` gris (`156,163,175,179`) : voir `exemples/qgis/rendu_toutes_couches.png`.

**Cause.** `rendererXml` ne génère un graduatedSymbol que si `s.graduated.classes.length` n'est pas nul. Les classes sont visiblement calculées à la volée côté client et ne sont jamais enregistrées.

**Correction suggérée.** Quand `classes` est vide, calculer les bornes côté serveur à l'export, avec la même méthode que l'interface (quantiles ou intervalles égaux, et la même palette).

### 5. Important : les accents sont illisibles dans le DXF

**Preuve.** Avec ezdxf comme avec OGR, les textes se lisent « MarchÃ© central » et « 1 MarchÃ© central ». AutoCAD et les autres lecteurs R12 afficheront la même chose.

**Cause.** Le texte est écrit en UTF-8 dans un DXF R12 sans `$DWGCODEPAGE`. Un DXF R12 est lu en page de code ANSI (cp1252).

**Correction suggérée.** Encoder les chaînes en cp1252 et déclarer `$DWGCODEPAGE = ANSI_1252` dans le HEADER. Autre solution : échapper les caractères non ASCII en `\U+00E9`.

### 6. Important : les courbes de niveau du DXF sont à Z = 0

**Preuve.** Les 117 polylignes de `Courbes_de_niveau_2_m_` ont une élévation de 0 et des sommets à z = 0, alors que la donnée a un champ `altitude`. Le DXF est donc inutilisable pour un MNT ou un profil dans un logiciel de DAO.

**Correction suggérée.** Écrire l'élévation de la POLYLINE (code de groupe 30 sur l'entité, ou z des VERTEX) à partir de `altitude`. Éventuellement, mettre les courbes maîtresses sur un calque à part (`Courbes_maitresses`).

### 7. Mineur : seules 2 classes graduées de bâti sur 5 sont utilisées

**Preuve.**
- Les bornes vont de 5,4 à 3 961,2, mais le filtre de la couche `surface_m2 > 100` est appliqué *physiquement* à l'export. Les valeurs exportées vont donc de 100,1 à 3 961,2.
- Résultat : 516 objets dans la classe 5, 354 dans la classe 4, et des classes 1 à 3 vides dans la légende.
- Les bornes ont été calculées sur la couche non filtrée. C'est fidèle à l'application, mais trompeur dans QGIS, et les bâtiments filtrés sont perdus.

**Correction suggérée.** Exporter tous les objets et traduire le filtre en `<subsetString>"surface_m2" > 100</subsetString>` dans le `.qgs`. Sinon, recalculer les bornes sur les objets filtrés.

### 8. Mineur : les repères numérotés n'ont pas d'étiquette

**Preuve.** Les objets de type « repère » ont `numero` et `legende`, mais pas `texte`. Une fois le défaut n° 3 corrigé, seuls les objets de type « texte » seront étiquetés.

**Correction suggérée.** Étiqueter avec une expression : `coalesce("texte", "numero" || ' ' || "legende")` et `isExpression="1"`. Le DXF, lui, affiche déjà « 1 Marché central ».

### 9. Mineur : les styles de trait sont perdus dans le DXF

**Preuve.**
- Le DXF ne définit que le type de ligne `CONTINUOUS` : l'emprise en tirets et le tampon en pointillés deviennent continus, et les hachures ne sont pas transmises.
- Le calque `Annotations` a la couleur ACI 140 (bleu clair) alors que ses entités sont en ACI 12 (rouge).
- Les noms de calques sont tronqués ou finissent par `_` (`Batiments_detectes_Google_Open_`).

**Correction suggérée.**
- Ajouter les types de ligne `DASHED` et `DOT` dans la table LTYPE.
- Donner aux calques la couleur des entités.
- Supprimer les `_` finaux des noms de calques.

### 10. Mineur : le croquis contient un sommet en double

**Preuve.** La ligne de type « croquis » a 2 sommets consécutifs identiques. C'est signalé par `qgis:checkvalidity` avec la méthode QGIS ; elle reste valide avec la méthode GEOS.

**Correction suggérée.** Dédoublonner les sommets consécutifs à l'enregistrement d'un croquis.

### 11. Mineur : `source` est doublement échappé dans `<layer-tree-layer>`

**Preuve.** On lit `source="type=xyz&amp;amp;url=…"`.

**Cause.** `esc()` est appliqué à un texte de `<datasource>` déjà échappé (`qgisProject.ts`, ligne 177). QGIS ne charge pas les couches à partir de cet attribut, donc l'effet est sans conséquence aujourd'hui, mais la valeur est fausse.

### 12. Mineur : l'attribution du fond ne correspond pas aux tuiles

**Preuve.** La couche « Vectoriel clair » charge `tile.openstreetmap.org`, mais ses `<rights>` indiquent « © OpenFreeMap, © OpenMapTiles ».

**Correction suggérée.** Utiliser l'attribution de la source XYZ effectivement chargée.

### 13. Mineur : WorldCover est rééchantillonné en bilinéaire

**Preuve.** L'image WorldCover est une classification, mais elle est déclarée avec `zoomedInResampler="bilinear"` : les limites de classes seront floues en zoom avant.

**Correction suggérée.** Utiliser le plus proche voisin, c'est-à-dire supprimer `zoomedInResampler` pour cette image.

### 14. Mineur : la police Inter est imposée aux étiquettes

**Preuve.** `fontFamily="Inter"` est fixé dans le style. QGIS la remplace par une autre police si elle n'est pas installée, ce qui est fréquent sous Windows.

**Correction suggérée.** Utiliser Arial ou une police par défaut de QGIS, ou bien fournir Inter dans le dossier exporté.

### 15. Mineur : noms des couches importées et type de `fid`

**Preuve.**
- Quand un GeoPackage ne contient qu'une couche, elle prend le nom du fichier (`modifie_seul`) au lieu du nom de la couche GeoPackage (`points_test_qgis`).
- Le `fid` est importé comme propriété de type texte (`"fid": "1"`).

**Correction suggérée.** Garder le nom de la table et ne pas importer le `fid`.

## Points conformes

- Le projet s'ouvre sans erreur, avec des chemins relatifs, en EPSG:32628.
- Les 10 couches vectorielles et les 4 rasters sont valides, et les nombres d'objets correspondent exactement au GeoPackage.
- Les SCR sont corrects : 32628, 4326 et 3857.
- Les styles catégorisé, gradué et à hachures sont bien interprétés. Le GeoPackage seul applique automatiquement ses styles.
- Il n'y a aucune géométrie invalide (au sens GEOS).
- Le calage des images est exact (world file centré sur les pixels, `.aux.xml` en EPSG:4326).
- Le DXF est conforme R12, sans erreur ezdxf ni OGR, avec une précision de 0,6 mm.
- L'aller-retour QGIS → `/api/import` est exact au millimètre, sans inversion d'axes.

Scripts et sorties brutes : `/tmp/claude-0/-home-user-repo/d04c7302-6ad4-5052-bd0d-8db035949e71/scratchpad/qgis/`, avec les scripts dans `scripts/` et les journaux dans `out/`.

---

## Deuxième passage (après corrections)

Nouveaux exports téléchargés le 04/11/2026 à 19:49 sur le serveur reconstruit, puis mêmes contrôles : QGIS 3.34.4, ezdxf, OGR et aller-retour `/api/import`. Les PNG de `exemples/qgis/` ont été remplacés par les rendus de ce passage, et 4 vues ont été ajoutées :
- `rendu_isochrones.png` ;
- `rendu_population.png` : population vue depuis le projet ;
- `rendu_population_gpkg_seul.png` : population vue depuis le GeoPackage ouvert seul ;
- `rendu_densite_chaleur.png`.

Entre les deux passages, le site s'est enrichi de couches d'analyse : « Zones d'analyse », « Isochrones à pied (15, 10, 5 min) », « Densité (100 m) — Annotations », « Chaleur — Annotations » et « Tampon 50 m — Chaleur — Annotations ». Le projet compte maintenant **23 couches**, et le GeoPackage 18 tables plus `layer_styles`.

### Vérification des 9 corrections annoncées

| n° | Correction | Résultat | Preuve |
|---|---|---|---|
| 1 | Identifiants de couches d'au moins 11 caractères | **Corrigé** | Tous les identifiants ont au moins 15 caractères (`fond_mw2j6ew000m`, …). **23 nœuds sur 23** sont résolus dans l'arbre. Le fond XYZ (EPSG:3857, valide) est **la dernière couche**. Ses tuiles ne sont pas rendues dans le bac à sable, faute d'accès réseau pour QGIS : ce n'est pas bloquant. |
| 2 | Une table par type de géométrie | **Corrigé** | Annotations : `annotations_points` (6), `annotations_lignes` (5), `annotations_polygones` (6). Isochrones : `…_polygones` (3), `…_points` (1). Chaque table a son style (marqueur, ligne, remplissage rouge à 15 %), dans le projet comme dans le GeoPackage seul. Rectangle, cercle, polygone, flèches, cotations et croquis sont visibles (`rendu_annotations_zoom.png`). |
| 3 | `priority="5"` sur `<placement>` | **Corrigé** | Étiquettes placées : « Marché central », « 1 », « 2 », « 4 » et « Îlot test » (zones d'analyse). Sur la vue d'ensemble, « 3 » est placé aussi. Les doublons superposés sont écartés par la gestion des collisions, ce qui est normal. |
| 4 | Classes graduées calculées à l'export | **Partiel** | **Dans le GeoPackage** (`layer_styles`) : 5 classes (10,3 – 109,1 – 157,4 – 188,8 – 204,9 – 239,9) avec 19, 18, 18, 18 et 17 objets. **Dans le `.qgs`** : la couche Population reste un `singleSymbol` gris (`156,163,175,179`). Voir le défaut R1. |
| 5 | DXF en Windows-1252 avec `$DWGCODEPAGE` | **Corrigé à l'export** | `$DWGCODEPAGE = ANSI_1252`. ezdxf et OGR lisent « Marché central » et « 1 Marché central » sans erreur. En revanche, l'import Chuilacarte de ce DXF lit maintenant les accents de travers (défaut R2). |
| 6 | Courbes à leur altitude | **Corrigé** | Élévations de 0, 2, 4 … 16 m, cohérentes avec le champ `altitude` du GeoPackage (0 à 16). OGR lit des Z de 0 à 16 sur `Courbes_de_niveau_2_m`. |
| 7 | Étiquettes `coalesce("texte", to_string("numero"))` | **Corrigé** | Les repères affichent leur numéro (1 à 4). |
| 8 | DASHED/DOT, calque Annotations en rouge, pas de `_` final | **Presque** | LTYPE `DASHED` (tiret de 2 m, espace de 1 m) et `DOT`, appliqués par calque : emprise, zones d'analyse et tampon 50 m en tirets, tampon 300 m en pointillés. Le calque Annotations est en ACI 1 (rouge). Il reste `Batiments_detectes_Google_Open_` avec un `_` final (défaut R5). |
| 9 | Source XYZ échappée une seule fois ; `fid` retiré à l'import | **Corrigé** | `source="type=xyz&amp;url=…"` est correct. Les couches réimportées n'ont plus de propriété `fid`. |

### Résultats chiffrés du deuxième passage

**Projet.** `read()` renvoie `True`, en EPSG:32628. Les **23 couches sont valides** et les nombres d'objets correspondent tous au GeoPackage. Les vecteurs sont en 32628, les images en 4326 et les XYZ en 3857. Les emprises des images n'ont pas changé, et le calage est toujours exact.

**Ordre des couches**, du dessus vers le dessous : annotations, analyses, emprise et tampon, voirie, bâti, limites, population, images, fond.

**GeoPackage seul.** Pour les 18 tables, le style de `layer_styles` est appliqué dès l'ouverture : catégorisé pour la voirie, gradué pour le bâti, la population, les isochrones et la densité. `loadDefaultStyle()` renvoie `True`.

**`qgis:checkvalidity`.** Aucune géométrie invalide avec la méthode GEOS sur les tables testées, nouvelles tables d'analyse comprises. Avec la méthode QGIS, il reste 1 erreur dans `annotations_lignes` : le sommet en double du croquis (ancien défaut n° 10, non traité).

**DXF.** `readfile`, `recover` et `audit` signalent 0 erreur. On compte 1329 entités sur 13 calques, avec X de 235 801 à 237 836 et Y de 1 623 064 à 1 625 398 (UTM 28N). L'emprise mesure toujours **323,283 m** dans le DXF contre **323,282 m** avec pyproj, soit un écart maximal de 0,6 mm.

**Aller-retour.**
- Le bâtiment ajouté dans QGIS revient à (−17,446000, 14,676000) avec **0,0 m d'écart**, et des côtés de 19,991 × 9,995 m.
- Les 3 points créés en EPSG:32628 reviennent exactement à leur position WGS84.
- 19 couches sont relues, sans `fid` ni `layer_styles`.

**Appréciation visuelle.**
- La carte est complète : annotations rouges lisibles avec leurs numéros, zone d'analyse en tirets violets étiquetée, voirie hiérarchisée, bâti gradué, courbes, et emprise hachurée.
- Les isochrones, visibles dans Chuilacarte (remplissage violet à 35 %), recouvrent une grande partie de la vue (`rendu_projet.png`). C'est fidèle au réglage du site.
- La population en classes est propre quand on ouvre le GeoPackage seul (`rendu_population_gpkg_seul.png`), mais elle reste grise dans le projet (`rendu_population.png`).

### Défauts restants

| n° | Gravité | Défaut |
|---|---|---|
| R1 | Important | La population n'est toujours pas graduée dans le `.qgs` |
| R2 | Important | Régression : l'import d'un DXF Chuilacarte casse les accents |
| R3 | Important | La carte de chaleur est exportée en points gris |
| R4 | Mineur | Le point d'origine des isochrones n'a pas de symbole |
| R5 | Mineur | Le calque DXF `Batiments_detectes_Google_Open_` garde un `_` final |
| R6 | Mineur | Les calques DXF d'analyse sont en gris neutre |
| R7 | Mineur | Classes graduées dégénérées (densité, bâti) |
| R8 | Mineur | Les annotations reviennent en 3 couches à l'import |
| R9 | Mineur | Anciens défauts mineurs non traités |

#### R1. Important : la population n'est toujours pas graduée dans le `.qgs`

**Preuve.** Dans le `.qgs`, `<renderer-v2 type="singleSymbol">` est gris. Dans `layer_styles`, la même couche a un `graduatedSymbol` à 5 classes. Le projet et le GeoPackage ne concordent donc pas.

**Cause probable.** Les classes sont calculées dans le chemin qui écrit `layer_styles`, mais `buildQgisBundle` appelle `layerQml(l, …)` avec la couche d'origine, dont `classes` est vide.

**Correction suggérée.** Calculer les classes une seule fois, avant les deux usages, et passer la couche complétée à `layerQml` dans `qgisProject.ts`.

#### R2. Important : régression, l'import d'un DXF Chuilacarte casse les accents

**Preuve.** Le DXF exporté, réimporté par `curl -F file=@site.dxf /api/import`, donne `"texte": "March� central"` (octets `EF BF BD`). Au premier passage, le texte revenait bien en « Marché central ».

**Cause probable.** `importers.ts` décode le DXF en UTF-8 (`text()`) sans lire `$DWGCODEPAGE`.

**Correction suggérée.** Lire `$DWGCODEPAGE`. Si la valeur est `ANSI_125x` ou si la version est antérieure à AC1021, décoder en `windows-125x` avec `TextDecoder`, sinon en UTF-8. Gérer aussi les séquences `\U+XXXX`.

#### R3. Important : la carte de chaleur est exportée en points gris

**Preuve.** La couche « Chaleur — Annotations » est en mode `heatmap` (rayon 30, intensité 1) dans Chuilacarte. Le projet et le GeoPackage contiennent un `singleSymbol` de marqueurs gris (`156,163,175,204`), et aucune chaleur n'apparaît dans QGIS.

**Correction suggérée.** Générer `<renderer-v2 type="heatmapRenderer" radius="…" radius_unit="0|1" … weight_expression="" quality="3"><colorramp …/></renderer-v2>`.

#### R4. Mineur : le point d'origine des isochrones n'a pas de symbole

**Preuve.** `isochrones_…_points` contient le seul point d'origine, avec `minutes = 0`. Il hérite du renderer gradué de 5 à 15 : `symbolForFeature` ne renvoie aucun symbole, et le point est invisible.

**Correction suggérée.** Pour les tables issues du découpage dont le champ de classement n'a pas de sens, utiliser un `singleSymbol`. Sinon, ajouter une classe 0–0.

#### R5. Mineur : le calque DXF `Batiments_detectes_Google_Open_` garde un `_` final

**Cause.** Le nom est tronqué à 31 caractères *après* la suppression des `_` finaux.

**Correction suggérée.** Supprimer les `_` après la troncature.

#### R6. Mineur : les calques DXF d'analyse sont en gris neutre

**Preuve.** Isochrones, densité et chaleur sont en ACI 9 (gris clair), alors qu'ils sont violets ou rouges dans Chuilacarte.

**Cause probable.** Ce sont des couches graduées ou en carte de chaleur, sans couleur unique.

**Correction suggérée.** Prendre la couleur de la classe médiane, ou colorer chaque entité selon sa classe (comme pour le bâti).

#### R7. Mineur : classes graduées dégénérées (densité, bâti)

**Preuve.**
- Densité : 2 classes, `0–0` et `0–6`, pour 22 hexagones à 0 et 1 à 6. Les cases vides sont dessinées en rose pâle.
- Bâti Google : toujours 2 classes utilisées sur 5 (516 et 354 objets), à cause du filtre `surface_m2 > 100` (ancien défaut n° 7, non traité).

**Correction suggérée.** Calculer les quantiles sur les valeurs distinctes, ou passer en intervalles égaux quand il y a moins de N valeurs distinctes. Recalculer les bornes après filtrage.

#### R8. Mineur : les annotations reviennent en 3 couches à l'import

**Preuve.** `annotations_points`, `annotations_lignes` et `annotations_polygones` (de même pour les isochrones) sont réimportées comme 3 couches distinctes au lieu de la couche mixte d'origine. Par ailleurs, un GeoPackage d'une seule couche est toujours nommé d'après le fichier (`modifie_seul`) et non d'après la table.

**Correction suggérée.** À l'import, regrouper les tables `<base>_points`, `<base>_lignes` et `<base>_polygones` en une seule couche. Garder le nom de la table.

#### R9. Mineur : anciens défauts mineurs non traités

- n° 10 : sommet en double dans le croquis ;
- n° 12 : attribution OpenFreeMap sur des tuiles OSM ;
- n° 13 : WorldCover rééchantillonné en bilinéaire ;
- n° 14 : police Inter imposée.

Aucun défaut n'est bloquant au deuxième passage. Les deux défauts importants les plus visibles au premier passage (fond absent, annotations et étiquettes invisibles) sont corrigés.

---

## Troisième passage (contrôle ciblé et non-régression)

Nouveaux exports téléchargés le 04/11/2026 sur le serveur reconstruit. Entre-temps, le site a encore reçu des couches :
- « Plan — projet_local », en polygones et en points ;
- « Image — plan_scan.png » ;
- « Ombres portées — 04/11/2026 09:00 », avec 2587 polygones.

Le projet compte maintenant **27 couches**, et le GeoPackage 21 tables plus `layer_styles`.

Rendus mis à jour dans `exemples/qgis/` : `rendu_projet.png`, `rendu_toutes_couches.png`, `rendu_population.png`, `rendu_isochrones.png`, `rendu_worldcover-2021.png`, `rendu_sentinel2-2026-10-23.png`, et un nouveau `rendu_chaleur.png`. Deux fichiers datent du 2e passage et n'ont pas été refaits : `rendu_densite_chaleur.png` (la chaleur y est encore en points gris) et `rendu_annotations_zoom.png`.

### Points corrigés

| Point | Résultat | Preuve |
|---|---|---|
| R1 Population graduée dans le `.qgs` | **Corrigé** | Le `.qgs` contient un `graduatedSymbol` à 5 classes (10,3 → 239,9), avec 19, 18, 18, 18 et 17 objets, comme le GeoPackage seul. Le rendu est en camaïeu orangé (`rendu_population.png`). |
| R2 Import DXF selon `$DWGCODEPAGE` | **Corrigé** | Le DXF exporté (ANSI_1252), réimporté par `/api/import`, redonne « Marché central » et « 1 Marché central ». Les entités reviennent en 14 points, 410 lignes et 3496 polygones. |
| R3 Carte de chaleur | **Corrigé** | `heatmapRenderer` : rayon 7,94 mm (environ 30 px), dégradé jaune → rouge, dans le `.qgs` comme dans `layer_styles`. Les taches de chaleur apparaissent sur les repères (`rendu_chaleur.png`). |
| R5 Noms de calques DXF | **Corrigé** | `Batiments_detectes_Google_Open` et `Ombres_portees_04_11_2026_09_00` : aucun nom ne finit par `_`, aucun ne dépasse 31 caractères. |
| R8 Nom de couche GeoPackage | **Corrigé** | Un GeoPackage d'une seule couche revient sous le nom `points_test_qgis`, c'est-à-dire la table, et non plus le nom du fichier. |
| WorldCover au plus proche | **Corrigé** | WorldCover n'a plus de `zoomedInResampler` : QGIS utilise le plus proche voisin. Sentinel-2 et le plan scanné restent en bilinéaire, ce qui est voulu. |

### Points sans effet sur ce site : R4 et R7

Le serveur ne recalcule les classes que si elles sont vides. Or les isochrones et la densité de `ui-collecte` ont déjà des classes enregistrées : la nouvelle règle ne s'applique donc pas ici.
- **Isochrones :** les classes restent `5–5`, `10–10` et `15–15`. Le point d'origine (`minutes = 0`) n'a toujours **aucun symbole** dans QGIS.
- **Densité :** les classes restent `0–0` et `0–6`.
- **Bâti Google :** toujours 2 classes utilisées sur 5, à cause du filtre `> 100`.

La correction ne pourra être vérifiée que sur une couche dont les classes sont vides, ou après avoir recalculé le style dans l'interface. Je ne l'ai pas fait : le site ne doit pas être modifié.

### Non-régression

- **Projet :** `read()` renvoie `True`, en EPSG:32628. Les **27 couches sur 27 sont valides**, et les 27 nœuds de l'arbre sont résolus, avec le fond XYZ en dernier. Les nombres d'objets correspondent tous au GeoPackage. Les SCR sont corrects : 32628 pour les vecteurs, 4326 pour les images, dont le nouveau plan scanné, et 3857 pour les XYZ. Aucune erreur de rendu.
- **GeoPackage seul :** les styles sont appliqués dès l'ouverture, y compris la carte de chaleur et la population graduée.
- **`qgis:checkvalidity` (GEOS) :** 0 géométrie invalide sur les ombres portées (2587), le plan de projet (3), le bâti Google (870) et la population (90).
- **DXF :** `readfile`, `recover` et `audit` signalent 0 erreur, sur 3920 entités et 15 calques. `$DWGCODEPAGE` vaut ANSI_1252, et les accents sont corrects dans ezdxf et OGR. L'emprise mesure **323,283 m** dans le DXF contre **323,282 m** avec pyproj, soit un écart maximal de 0,6 mm.
- **Aller-retour :** 22 couches sont relues, sans `fid`. Le bâtiment ajouté dans QGIS revient avec **0,0 m d'écart**, et les points créés en EPSG:32628 reviennent exactement à leur position.

### Défauts restants

| n° | Gravité | Défaut | Statut |
|---|---|---|---|
| 1 | Mineur | Point d'origine des isochrones sans symbole, classes 5–5/10–10/15–15 | Le correctif R4 ne touche pas les classes déjà enregistrées. |
| 2 | Mineur | Densité en classes `0–0`/`0–6` ; bâti Google : 2 classes sur 5 | Même cause (R7). Il faudrait recalculer aussi les classes dégénérées : bornes en double, ou classes sans aucun objet. |
| 3 | Mineur | Couleurs des calques DXF d'analyse (R6) | Non traité volontairement : les entités portent leur couleur. |
| 4 | Mineur | Tables `_points`/`_lignes`/`_polygones` réimportées en 3 couches | Non traité volontairement. |
| 5 | Mineur | Police Inter imposée | Non traité volontairement. |
| 6 | Mineur | Sommet en double dans le croquis (`qgis:checkvalidity`, méthode QGIS) | Non traité. |
| 7 | Mineur | Attribution OpenFreeMap sur des tuiles OSM | Non traité. |

Aucun défaut n'est bloquant ni important au troisième passage.
