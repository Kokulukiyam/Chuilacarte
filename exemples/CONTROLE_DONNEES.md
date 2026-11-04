# Contrôle des données collectées — Chuilacarte

Contrôle fait le 4 novembre 2026 par l'agent de test des données, sur la version de production (`http://localhost:3300`). Aucun fichier de code n'a été modifié.

## Méthode

- **Sites.** Trois sites ont été créés avec `POST /api/sites`. La collecte a été lancée depuis l'interface : `collect-open`, puis `collect-run`, attente de « Relancer », puis « Fermer » et attente de la sauvegarde automatique. Toutes les sources étaient cochées (OSM, Overture, Google Open Buildings, geoBoundaries, Copernicus DEM, WorldPop, WorldCover, JRC GSW, Sentinel-2).

  | Slug | Nom | Tampon |
  |---|---|---|
  | `test-donnees-ilot-medina` | Test données — îlot Médina | 200 m |
  | `test-donnees-yoff` | Test données — Yoff | 500 m |
  | `test-donnees-fatick-centre` | Test données — Fatick centre | 500 m |

- **Recalculs.** Ils ont été faits à partir des fichiers `data/sites/<slug>/layers/*.geojson`, avec Python (pyproj et shapely) :
  - en UTM 28N (EPSG:32628), la projection utilisée par l'application ;
  - en géodésique sur l'ellipsoïde WGS84 (`pyproj.Geod`), qui sert de référence « vraie ».
- **Contrôles sur les sources brutes.**
  - Population : le GeoTIFF WorldPop mis en cache (`data/cache/files/worldpop_sen_2026.tif`) a été relu pixel par pixel.
  - Courbes de niveau : elles ont été comparées aux tuiles Copernicus DEM GLO-30 (N14W018 et N14W017), téléchargées indépendamment.
  - Calage des rasters : l'image Sentinel-2 a été comparée visuellement à WorldCover (trait de côte de Yoff) et aux vecteurs OSM (Fatick).
- **Mesures dans l'interface.**
  - Onglet Site : surface, périmètre, surface avec tampon.
  - Une distance (touche « m ») et une surface (touche « s ») mesurées sur l'îlot Médina. Les clics sont reconvertis en lon/lat avec `__map.unproject`.
  - Synthèse urbaine pour les zones `emprise`, `tampon` et pour la comparaison emprise/tampon, avec l'export CSV de chacune.
- **Scripts et sorties.** Ils sont dans le bac à sable de l'agent, hors dépôt : `check.py`, `recalc.py`, `wp.py`, `dem.py`, `rast.py`, les CSV exportés et les captures.

**Accès réseau pendant le test.** Overpass a répondu pour les trois sites : `maps.mail.ru` pour Médina et Yoff, `overpass-api.de` pour Fatick. Le repli sur l'API OSM 0.6 n'a donc **pas** servi cette fois-ci, alors qu'il est habituel depuis ce bac à sable. **Aucune source n'est en échec** : le rapport de collecte n'a aucun item `ok: false` pour les trois sites. Durées de collecte : Médina 115 s, Yoff 118 s (68 s à la relance), Fatick 42 s. Ces durées ont été mesurées avec les trois collectes lancées en parallèle.

**Tolérance demandée : écart < 0,5 % sur les surfaces et les longueurs.** Tous les recalculs de surface et de longueur la respectent. Le seul dépassement chiffré porte sur la population estimée de la zone « emprise + tampon » (défaut 3).

---

## 1. Îlot Médina (`test-donnees-ilot-medina`, tampon 200 m)

Emprise : lon −17,4475 à −17,4445, lat 14,6745 à 14,6770. Tampon (bbox) : lon −17,44936 à −17,44264, lat 14,6727 à 14,6788. Aucune inversion latitude/longitude ni aucun décalage dans aucune couche.

### Couches

Pour toutes les couches vectorielles, 100 % des objets recoupent le tampon. « Débordent » désigne les objets conservés entiers qui sortent en partie du tampon. Le nombre d'objets de `site.json` est égal au nombre d'objets du fichier pour toutes les couches.

| Couche | Source | Objets | Contrôle de position | Plausibilité et attributs |
|---|---|---|---|---|
| Bâtiments (OSM) | Overpass (maps.mail.ru) | 366 | bbox −17,4497..−17,4420 / 14,6732..14,6790 ; 5,2 % débordent | médiane 149 m² ; `niveaux` 2 (1 %), `hauteur` 0 ; OSM peu complet (≈ 21 % du nombre Google) |
| Bâtiments (Overture) | Overture 2026-10-21.0 | 1 144 | 5,5 % débordent | 615 Google, 366 OSM, 163 Microsoft ; `niveaux` quasi vide (2) |
| Bâtiments détectés (Google) | VIDA / Source Coop. | 1 723 | 4,5 % débordent | confiance de 0,65 à 0,944 (moyenne 0,76 ; 402 < 0,70) ; `surface_m2` conforme à l'aire recalculée (écart médian 0,27 %) ; médiane 70 m², soit 38 bâtiments/ha : tissu très dense, cohérent |
| Voirie (OSM) | Overpass | 114 | voies conservées entières (jusqu'à lat 14,6845) | desserte 96, primaire 10, secondaire 7, piéton 1 ; `classe` 100 % |
| Réseau routier (Overture) | Overture | 206 | 17,5 % débordent | desserte 169, primaire 22, secondaire 14, piéton 1 ; géométries identiques à OSM (mêmes longueurs au mètre près) |
| Équipements (OSM) | Overpass | 28 | dans le tampon | `famille` 100 % : transport 9, commerce 5, culte 4, santé 3, enseignement 3, administration 2, sport et loisirs 2 |
| Points d'intérêt (OSM) | Overpass | 42 | dans le tampon | `categorie` 100 % (commerce 30, service 10, bureau 2) |
| Lieux (Overture) | Overture | 99 | **20 lieux empilés sur 2 points** (défaut 8) | 93 % Meta ; confiance moyenne 0,56, 0,42 pour les lieux empilés |
| Espaces verts (OSM) | Overpass | 3 | 2 sur 3 débordent | terrains de sport |
| Occupation du sol (OSM) | Overpass | 7 | un polygone `residential` couvre tout Dakar (bbox −17,53..−17,23) | contient aussi une station-service qui est en même temps un bâtiment (défaut 9) |
| Plans d'eau, cours d'eau, voies ferrées (OSM) | Overpass | 0 / 0 / 0 | — | normal à la Médina |
| Limites administratives | geoBoundaries | 3 | entourent le site | région, département et arrondissement de Dakar |
| Courbes de niveau (2 m) | Copernicus GLO-30 | 7 | **écart médian entre la courbe et le MNS brut : 0,018 m** ; un décalage d'un demi-pixel donnerait 0,60 à 0,71 m | courbes de 4 à 16 m ; MNS de 2,9 à 17,6 m (modèle de surface, bâti compris) : plausible (attendu 0 à 40 m) |
| Population 2026 (WorldPop) | WorldPop R2025A | 59 carreaux | valeurs et bords identiques au GeoTIFF (écart ≤ 0,05 hab., décalage 0°) | 9 957 hab. dans les carreaux retenus ; densité médiane 224 hab./ha, maximale 289 ; 222 hab./ha sur l'emprise |
| Sentinel-2 du 23/10/2026 | Planetary Computer | 1 image 256 × 256 | bornes = bbox du tampon, au mètre près | 0,6 % de nuages sur la tuile |
| WorldCover 2021 | ESA | 1 image 82 × 74 | bornes calées sur les pixels, 4 à 6 m au-delà du tampon : couvre le site | bâti 99 % : cohérent |
| Eau JRC (occurrence, changement) | JRC GSW | 2 couches de tuiles | tuiles z13 servies (HTTP 200) | rien à signaler |

**Population.** 222 hab./ha est un chiffre élevé, mais probablement **sous-estimé** pour la Médina, qui compte plutôt 400 à 500 hab./ha bruts. La valeur vient de WorldPop lui-même : elle a été vérifiée sur le GeoTIFF. Ce n'est pas une erreur de l'application, mais c'est une limite à signaler sur les planches.

### Recouvrement du bâti

| Test | Résultat |
|---|---|
| Centroïdes OSM dans un bâtiment Google | 74,6 % |
| Centroïdes Google dans un bâtiment OSM | 23,3 % (OSM incomplet) |
| Centroïdes OSM dans Overture | 100 % (Overture reprend OSM) |
| Centroïdes Google dans Overture | 69,8 % (la conflation Overture écarte une partie de Google) |
| IoU OSM/Google des paires appariées (n = 202) | médiane 0,44 ; décalage moyen Google − OSM : +1,7 m E, −0,7 m N, donc pas de décalage systématique |
| Surface bâtie dans l'emprise | OSM 14 856 m², Overture 32 693 m², Google 41 548 m² (union 41 357 m² : 0,5 % de recouvrement entre empreintes Google) |

### Recalculs : îlot Médina

Le recalcul UTM est fait dans la même projection que l'application. Le recalcul géodésique sert de référence, et l'écart indiqué est celui de l'application par rapport à cette référence.

| Grandeur | Application | Recalcul UTM | Recalcul géodésique | Écart app / géodésique |
|---|---|---|---|---|
| Surface de l'emprise (onglet Site) | 8,95 ha (89 465 m²) | 89 464,9 | 89 383,0 | +0,09 % |
| Périmètre (onglet Site) | 1,20 km | 1 200,04 m | 1 199,49 m | +0,05 % |
| Surface avec tampon (onglet Site) | 45,42 ha (454 215 m²) | 454 215,0 | 453 798,9 | +0,09 % |
| Distance mesurée, touche « m » (2 points) | 333,4 m | 333,36 | 333,21 | +0,06 % |
| Surface mesurée, touche « s » (4 points) | 4,22 ha (42 155 m²) | 42 154,8 | 42 116,2 | +0,09 % |
| Périmètre de la surface mesurée | 832,8 m | 832,78 | 832,39 | +0,05 % |
| Synthèse emprise : surface totale | 89 465 m² | 89 464,9 | 89 383,0 | +0,09 % |
| Synthèse emprise : nombre de bâtiments (Google) | 380 | 380 | — | 0 |
| Synthèse emprise : surface bâtie | 41 548 m² | 41 547,9 | 41 509,8 | +0,09 % |
| Synthèse emprise : CES | 46,4 % | 46,44 % | — | 0 |
| Synthèse emprise : voie primaire | 168 m | 167,7 | 167,7 | +0,05 % |
| Synthèse emprise : voie secondaire | 218 m | 217,7 | 217,6 | +0,05 % |
| Synthèse emprise : voie de desserte | 2 171 m | 2 171,1 | 2 170,1 | +0,05 % |
| Synthèse emprise : linéaire total | 2 557 m | 2 556,5 | 2 555,3 | +0,05 % |
| Synthèse emprise : équipements | 9 | 9 | — | 0 |
| Synthèse emprise : population | 1 985 hab. | 1 985,2 | GeoTIFF : 1 985 | 0 |
| Synthèse emprise : densité | 222 hab./ha | 221,9 | — | 0 |
| Synthèse tampon : nombre de bâtiments | 1 718 | 1 718 | — | 0 |
| Synthèse tampon : surface bâtie | 187 332 m² | 187 332,0 | 187 160,4 | +0,09 % |
| Synthèse tampon : linéaire de voirie | 12 538 m | 12 537,8 | 12 532,0 | +0,05 % |
| Synthèse tampon : chemin piéton | 91 m | 91,2 | 91,1 | 0 |
| Synthèse tampon : espaces verts | 5 559 m² | 5 559,1 | — | 0 |
| **Synthèse tampon : population** | **9 121 hab.** | 9 121,0 (mêmes carreaux) | **GeoTIFF, pondération exacte : 9 366** | **−2,61 %** (défaut 3) |

---

## 2. Yoff (`test-donnees-yoff`, tampon 500 m)

Emprise : lon −17,4950 à −17,4700, lat 14,7450 à 14,7650. Polygone fourni, sans passer par le géocodage. L'emprise contient l'ancienne piste de l'aéroport Léopold Sédar Senghor et le trait de côte au nord-ouest. Aucune inversion ni aucun décalage.

### Couches

Pour toutes les couches vectorielles, 100 % des objets recoupent le tampon. Le nombre d'objets de `site.json` est égal au nombre d'objets du fichier.

| Couche | Source | Objets | Contrôle de position | Plausibilité et attributs |
|---|---|---|---|---|
| Bâtiments (OSM) | Overpass (maps.mail.ru) | 788 | 3,2 % débordent | 27 avec `niveaux` (moyenne 4,2, maximum 9) ; OSM très incomplet (4 % du nombre Google) |
| Bâtiments (Overture) | Overture | 11 504 | 0,9 % débordent | 7 440 Google, 3 276 Microsoft, 788 OSM |
| Bâtiments détectés (Google) | VIDA | 18 478 | 0,8 % débordent | confiance de 0,65 à 0,964 (moyenne 0,77 ; 3 544 < 0,70) ; médiane 70 m² |
| Voirie (OSM) | Overpass | 1 614 | 6 % débordent | desserte 1 442, piéton 81, primaire 46, tertiaire 45 |
| Réseau routier (Overture) | Overture | 3 144 | 3,1 % débordent | desserte 2 692, tertiaire 279, primaire 106, piéton 67 ; mêmes longueurs qu'OSM |
| Équipements (OSM) | Overpass | 173 | dans le tampon | transport 60 (dont 43 arrêts), commerce 30, enseignement 27, culte 21, santé 19, administration 12, sport et loisirs 4 |
| Points d'intérêt (OSM) | Overpass | 204 | dans le tampon | `categorie` 100 % |
| Lieux (Overture) | Overture | 377 | **70 lieux empilés sur 14 coordonnées** (défaut 8) | 360 Meta |
| Espaces verts, occupation du sol, cours d'eau (OSM) | Overpass | 29 / 30 / 26 | occupation : polygone `residential` étendu à tout Dakar | occupation : 8 `swimming_pool`, 2 restaurants et 1 station de lavage qui sont aussi des bâtiments (défaut 9) |
| Plans d'eau, voies ferrées (OSM) | Overpass | 0 / 0 | — | la mer n'est pas un polygone OSM : normal |
| Limites administratives | geoBoundaries | 4 | — | région, département, 2 arrondissements |
| Courbes de niveau (5 m) | Copernicus | 8 | **écart médian entre la courbe et le MNS : 0,015 m** (0,51 à 0,56 m avec un décalage d'un demi-pixel) | courbes de 0 à 35 m ; MNS de −1,0 à 39,5 m : plausible (attendu 0 à 40 m) |
| Population (WorldPop) | WorldPop | 962 carreaux | identiques au GeoTIFF | 86 731 hab. ; 96 hab./ha sur l'emprise (aéroport compris) : plausible |
| Sentinel-2 du 23/10/2026 | Planetary Computer | 922 × 806 (4 m/px) | bornes = bbox du tampon ; trait de côte superposable à WorldCover | 0,6 % de nuages |
| WorldCover 2021 | ESA | 412 × 348 | 0,4 à 1,8 m au-delà du tampon | bâti, eau permanente (mer), prairies (piste), cultures : cohérent avec l'image |
| Eau JRC | JRC GSW | 2 | tuile z13 servie, 28 % de pixels opaques (mer) | rien à signaler |

### Recouvrement du bâti

| Test | Résultat |
|---|---|
| Centroïdes OSM dans un bâtiment Google | 82,5 % |
| Centroïdes Google dans un bâtiment OSM | 4,6 % |
| Centroïdes OSM dans Overture | 100 % |
| Centroïdes Google dans Overture | 63,3 % |
| Centroïdes Overture dans un bâtiment Google | 91,8 % |
| IoU OSM/Google des paires appariées (n = 524) | médiane 0,49 ; décalage moyen +1,7 m E, −0,8 m N |
| Surface bâtie dans l'emprise | OSM 118 100 m², Overture 910 786 m², Google 1 327 860 m² (union 1 321 314 m² : 0,5 % de recouvrement) |

### Recalculs : Yoff

| Grandeur | Application | Recalcul UTM | Recalcul géodésique | Écart app / géodésique |
|---|---|---|---|---|
| Surface de l'emprise (onglet Site) | 5,96 km² (synthèse : 5 962 517 m²) | 5 962 516,8 | 5 956 754,5 | +0,10 % |
| Périmètre (onglet Site) | 9,81 km | 9 814,2 m | 9 809,5 m | +0,05 % |
| Surface avec tampon | 11,64 km² (11 643 717 m²) | 11 643 716,5 | 11 632 463,6 | +0,10 % |
| Synthèse emprise : nombre de bâtiments | 13 321 | 13 321 | — | 0 |
| Synthèse emprise : surface bâtie | 1 327 861 m² | 1 327 861,4 | 1 326 582,7 | +0,10 % |
| Synthèse emprise : CES | 22,3 % | 22,27 % | — | 0 |
| Synthèse emprise : voie primaire | 8 988 m | 8 988,2 | 8 983,8 | +0,05 % |
| Synthèse emprise : voie tertiaire | 8 293 m | 8 292,6 | 8 288,6 | +0,05 % |
| Synthèse emprise : voie de desserte | 97 296 m | 97 296,5 | 97 249,6 | +0,05 % |
| Synthèse emprise : chemin piéton | 6 718 m | 6 718,0 | 6 714,8 | +0,05 % |
| Synthèse emprise : linéaire total | 121 295 m | 121 295,3 | 121 236,8 | +0,05 % |
| Synthèse emprise : équipements | 81 | 81 | — | 0 |
| Synthèse emprise : population | 57 099 hab. | 57 098,5 | GeoTIFF : 57 100 | 0 |
| Synthèse emprise : espaces verts | 49 952 m² | 49 951,7 | — | 0 |
| Synthèse tampon : nombre de bâtiments | 18 474 | 18 474 | — | 0 |
| Synthèse tampon : surface bâtie | 1 963 877 m² | 1 963 877,4 | 1 961 991,9 | +0,10 % |
| Synthèse tampon : linéaire total | 185 964 m | 185 964,2 | 185 874,8 | +0,05 % |
| **Synthèse tampon : population** | **85 066 hab.** | 85 066,2 | **GeoTIFF : 85 513** | **−0,52 %** (défaut 3) |

---

## 3. Fatick centre (`test-donnees-fatick-centre`, tampon 500 m)

Emprise : lon −16,4180 à −16,4060, lat 14,3330 à 14,3420. Aucune inversion ni aucun décalage. Superposée à l'image Sentinel-2, la voirie OSM tombe sur les avenues, le rond-point et la piste du stade.

### Couches

Pour toutes les couches vectorielles, 100 % des objets recoupent le tampon, sauf les limites administratives (75 %). Le nombre d'objets de `site.json` est égal au nombre d'objets du fichier.

| Couche | Source | Objets | Contrôle de position | Plausibilité et attributs |
|---|---|---|---|---|
| Bâtiments (OSM) | Overpass (overpass-api.de) | 2 780 | 1,4 % débordent | médiane 60 m² ; aucun `niveaux` ; 1 polygone dégénéré de 0,04 m² (way 744408910) |
| Bâtiments (Overture) | Overture | 7 184 | 1,3 % débordent | 4 007 Google, 2 771 OSM, 406 Microsoft ; 1 objet < 2 m² |
| Bâtiments détectés (Google) | VIDA | 8 258 | 1,5 % débordent | confiance de 0,65 à 0,954 (moyenne 0,78 ; 1 399 < 0,70) ; médiane 46 m² ; 19 bâtiments/ha dans l'emprise : cohérent pour une ville moyenne |
| Voirie (OSM) | Overpass | 451 | voies conservées entières, jusqu'à 3,7 km au nord du tampon (lat 14,3802) | desserte 417, tertiaire 24, primaire 8, piéton 2 |
| Réseau routier (Overture) | Overture | 1 167 | 6,9 % débordent | desserte 985, tertiaire 116, primaire 64, piéton 2 |
| Équipements (OSM) | Overpass | 22 | dans le tampon | administration 7 (chef-lieu de région : cohérent), commerce 4, culte 3, enseignement 3, transport 2, santé 2, sport et loisirs 1 |
| Points d'intérêt (OSM) | Overpass | 11 | dans le tampon | — |
| Lieux (Overture) | Overture | 21 | **13 des 21 lieux empilés sur 2 points**, dont « NDIOB Commune », « Lycée de Bicole » et « ISFM de Fatick » (défaut 8) | peu de lieux : cohérent avec la taille de la ville |
| Plans d'eau (OSM) | Overpass | 13 | 15 % débordent | 33 369 m² dans l'emprise (tannes et bolongs) |
| Espaces verts, occupation du sol (OSM) | Overpass | 1 / 17 | — | occupation : 12 `brownfield`, et une station-service qui est aussi un bâtiment (défaut 9) |
| Cours d'eau, voies ferrées (OSM) | Overpass | 0 / 0 | — | — |
| Limites administratives | geoBoundaries | 4 | **l'arrondissement de Niakhar ne touche pas le tampon** (à environ 75 m), il est retenu par le test sur la bbox (défaut 10) | région, département, 2 arrondissements |
| Courbes de niveau (1 m) | Copernicus | 9 | **écart médian entre la courbe et le MNS : 0,008 m** (0,25 m avec un décalage d'un demi-pixel) | courbes de 1 à 9 m ; MNS de 0,5 à 9,9 m : plausible (attendu 0 à 20 m) |
| Population (WorldPop) | WorldPop | 524 carreaux | identiques au GeoTIFF | 36 087 hab. ; 89 hab./ha sur l'emprise |
| Sentinel-2 du 23/10/2026 | Planetary Computer | 573 × 500 | bornes = bbox du tampon | 0 % de nuages |
| WorldCover 2021 | ESA | 256 × 216 | 0,4 à 2,7 m au-delà du tampon | bâti 58 %, prairies 23 %, cultures 16 % : cohérent |
| Eau JRC | JRC GSW | 2 | tuile z13 servie | rien à signaler |

### Recouvrement du bâti

| Test | Résultat |
|---|---|
| Centroïdes OSM dans un bâtiment Google | 59,3 % (petites cases et annexes cartographiées dans OSM, non détectées par Google) |
| Centroïdes Google dans un bâtiment OSM | 19,8 % |
| Centroïdes OSM dans Overture | 99,9 % |
| Centroïdes Google dans Overture | 69,5 % |
| IoU OSM/Google des paires appariées (n = 1 074) | médiane 0,44 ; décalage moyen −2,1 m E, +1,2 m N, sous la résolution de l'imagerie |
| Surface bâtie dans l'emprise | OSM 78 546 m², Overture 158 969 m², Google 178 526 m² |

### Recalculs : Fatick

À Fatick, longitude −16,4, on est plus près du méridien central de la zone UTM 28 (−15°). L'écart entre UTM et géodésique change de signe.

| Grandeur | Application | Recalcul UTM | Recalcul géodésique | Écart app / géodésique |
|---|---|---|---|---|
| Surface de l'emprise (onglet Site) | 1,29 km² (1 288 741 m²) | 1 288 741,0 | 1 289 032,9 | −0,02 % |
| Périmètre (onglet Site) | 4,58 km | 4 580,0 m | 4 580,6 m | −0,01 % |
| Surface avec tampon | 4,35 km² (4 354 480 m²) | 4 354 479,7 | 4 355 465,7 | −0,02 % |
| Synthèse emprise : nombre de bâtiments | 2 494 | 2 494 | — | 0 |
| Synthèse emprise : surface bâtie | 178 525 m² | 178 524,9 | 178 565,4 | −0,02 % |
| Synthèse emprise : CES | 13,9 % | 13,85 % | — | 0 |
| Synthèse emprise : voie primaire | 1 141 m | 1 140,7 | 1 140,8 | 0 |
| Synthèse emprise : voie tertiaire | 2 198 m | 2 198,4 | 2 198,7 | 0 |
| Synthèse emprise : voie de desserte | 24 515 m | 24 514,9 | 24 517,7 | −0,01 % |
| Synthèse emprise : chemin piéton | 208 m | 208,1 | 208,1 | 0 |
| Synthèse emprise : linéaire total | 28 062 m | 28 062,1 | 28 065,3 | −0,01 % |
| Synthèse emprise : population | 11 494 hab. | 11 494,0 | GeoTIFF : 11 494 | 0 |
| Synthèse emprise : surfaces en eau | 33 369 m² | 33 369,2 | — | 0 |
| Synthèse emprise : espaces verts | 8 093 m² | 8 092,7 | — | 0 |
| Synthèse tampon : nombre de bâtiments | 8 254 | 8 254 | — | 0 |
| Synthèse tampon : surface bâtie | 598 320 m² | 598 320,0 | 598 456,4 | −0,02 % |
| Synthèse tampon : linéaire total | 86 351 m | 86 351,5 | 86 361,3 | −0,01 % |
| Synthèse tampon : surfaces en eau | 70 946 m² | 70 944,6 | — | 0 |
| **Synthèse tampon : population** | **35 547 hab.** | 35 547,0 | **GeoTIFF : 36 354** | **−2,22 %** (défaut 3) |

---

## 4. Bilan des contrôles

- **Position.** Toutes les couches sont bien placées, avec longitude ≈ −17,4/−16,4 et latitude ≈ 14,7/14,3. Les courbes de niveau collent au MNS brut au centimètre près. L'image Sentinel-2, WorldCover et les vecteurs OSM se superposent. Les carreaux WorldPop sont identiques au GeoTIFF source.
- **Mesures.** L'application calcule en UTM 28N, et ses résultats sont identiques à mon recalcul UTM, à l'arrondi près. Par rapport au calcul géodésique, l'écart vaut +0,09 à +0,10 % sur les surfaces à Dakar et −0,02 % à Fatick, et +0,05 % sur les longueurs à Dakar. C'est l'effet du facteur d'échelle UTM à 2,5° du méridien central. Ces écarts sont **sous la tolérance de 0,5 %**.
- **Zone tampon.** Calculée par `turf.buffer` avec 69 sommets, elle a une distance réelle à l'emprise de 497,5 à 500,7 m pour un tampon de 500 m, et de 199,0 à 200,3 m pour 200 m. Sa surface est inférieure de 0,12 à 0,25 % à celle d'un tampon exact. C'est sous la tolérance, mais à la limite pour la distance aux sommets (−0,5 %).
- **Sources en échec : aucune.** Overpass a répondu, donc le repli sur l'API OSM 0.6 n'a pas été exercé dans ce test. Il l'avait été sur les sites `controle-*` créés plus tôt. Sentinel-2, WorldCover, WorldPop, GSW, geoBoundaries, Overture et Google Open Buildings ont tous répondu.

---

## 5. Défauts constatés

1. **Bloquant. Le tableau et le CSV de comparaison de deux zones décalent les lignes.**
   - *Preuve.* Médina, comparaison emprise / tampon (`synthese-comparaison.csv`). La colonne « Emprise + tampon » affiche « Linéaire de voirie total : 91 m » (c'est en réalité le chemin piéton), « Densité de voirie : 12 538 m », « Équipements dans la zone : 27,6 » et « Population estimée : 0 dans la zone… ». La ligne « Surfaces en eau » du tampon disparaît.
   - *Cause.* `synthesisRows` (`lib/analysis.ts`, l. 333) n'ajoute une ligne de voirie que pour les classes présentes dans la zone. Or `synthesisCsv` (l. 353) et le tableau (`components/AnalysisTools.tsx`, l. 122-127) apparient les zones par indice de ligne. Dès qu'une zone a une classe de voirie que l'autre n'a pas, toutes les lignes suivantes sont fausses, sans aucun avertissement.
2. **Important. Après une collecte, l'enregistrement des couches dans `site.json` dépend d'une réexpédition complète des données par le navigateur.**
   - *Preuve.* Sur Yoff, 4 s après « Fermer », `site.json` ne contenait encore que l'emprise et le tampon (`reports: []`). À la relance, le navigateur a renvoyé 12 couches en PUT, soit 13,4 Mo dont 7,4 Mo pour Google et 4,0 Mo pour Overture, avant d'écrire `site.json`. L'indicateur affichait encore « Enregistrement… » à la fermeture.
   - *Risque.* Si l'onglet est fermé ou si un PUT échoue, les fichiers de couches sont présents sur le disque mais absents du site.
   - *Cause.* `CollectDialog.tsx` (l. 92) marque toutes les couches collectées comme modifiées (`touched`), alors que le serveur vient de les écrire. Ensuite, `lib/autosave.ts` écrit les couches avant `site.json`, une par une.
3. **Important. La population de la zone « emprise + tampon » est sous-estimée de 0,5 à 2,6 %.**
   - *Preuve.* Comparaison à une pondération exacte sur le GeoTIFF : Médina 9 121 contre 9 366 (−2,61 %), Fatick 35 547 contre 36 354 (−2,22 %), Yoff 85 066 contre 85 513 (−0,52 %). Sur l'emprise seule, l'écart est nul.
   - *Cause.* Le collecteur WorldPop (`lib/server/collect/rasters.ts`, l. 30) ne garde que les carreaux dont le **centre** est dans le tampon. Les carreaux de bord sont donc perdus, alors que la synthèse pondère ensuite par la surface recoupée. Le même biais touche toute zone dessinée près du bord du tampon.
4. **Mineur. Le choix automatique de la couche de bâti fait perdre les niveaux.**
   - *Preuve.* À Yoff, 27 bâtiments OSM ont des `niveaux` (moyenne 4,2). La synthèse prend la couche Google (0 bâtiment renseigné) et applique l'hypothèse de 2 niveaux à tout. Le COS est donc sous-estimé dans les quartiers à R+3 ou R+4.
   - *Cause.* `pickLayer` (`lib/analysis.ts`, l. 144) choisit la couche qui a le plus d'objets, sans tenir compte des attributs.
5. **Mineur. La couche Google Open Buildings brute contient des empreintes qui se recouvrent et des détections peu sûres.**
   - *Preuve.* La surface bâtie (somme des empreintes) dépasse l'union de 0,5 % (Médina 41 548 contre 41 357 m² ; Yoff 1 327 860 contre 1 321 314 m²). 19 à 23 % des empreintes ont une confiance inférieure à 0,70, et aucun filtre par défaut n'est appliqué.
   - *Cause.* `clippedArea` est sommé objet par objet. Le collecteur Google n'applique aucun seuil de confiance.
6. **Mineur. Les surfaces et les longueurs sont planes en UTM 28N, et non géodésiques.**
   - *Preuve.* +0,09 à +0,10 % sur les surfaces et +0,05 % sur les longueurs à Dakar ; −0,02 % à Fatick.
   - *Conséquence.* C'est conforme à ce qu'affiche l'interface (« UTM 28N »), et sous la tolérance. L'écart dépasserait 0,5 % pour un site à plus de 4° environ du méridien central, par exemple à l'est du Sénégal, au-delà de −11°. Le calcul est alors fait dans la zone 29, mais il faut le savoir.
7. **Mineur. Le tampon est grossièrement polygonisé.**
   - *Preuve.* 69 sommets au total (`steps: 16`). La distance aux sommets descend jusqu'à −0,5 % (497,5 m pour 500 m) et la surface est inférieure de 0,12 à 0,25 % à celle d'un tampon exact.
   - *Cause.* `bufferedEmprise` (`lib/site.ts`) utilise `turf.buffer`, qui travaille sur une sphère.
8. **Mineur. Des lieux Overture sont empilés sur des centroïdes fictifs.**
   - *Preuve.* 20 lieux sur 99 à la Médina, dont « Dakar Aéroport » placé dans l'îlot ; 70 sur 377 à Yoff ; 13 sur 21 à Fatick, dont « NDIOB Commune » et des lycées tous au même point (−16,4167 ; 14,3333). Leur confiance moyenne est plus basse (0,41 à 0,58, contre 0,56 à 0,76 pour les autres lieux).
   - *Cause.* C'est une limite des données Meta. Le collecteur n'applique ni seuil de confiance ni repérage des points empilés.
9. **Mineur. Des bâtiments OSM porteurs d'un `amenity` sont aussi versés dans « Occupation du sol ».**
   - *Preuve.* Station-service 207481200 (Médina), restaurants 521503196 et 521503197 et station de lavage 1003726464 (Yoff), station-service 240505385 (Fatick). Ils figurent à la fois dans `osm-batiments` et dans `osm-occupation`.
   - *Cause.* `classifyOsm` (`lib/server/collect/osm.ts`, l. 178-214) ne fait pas de `continue` après le bâti, et la règle « `isPoly && t.amenity` » de la ligne 211 les reprend comme occupation du sol.
10. **Mineur. Des limites administratives hors tampon sont retenues.**
    - *Preuve.* À Fatick, l'arrondissement de Niakhar ne recoupe pas le tampon (environ 75 m) mais il est dans la couche.
    - *Cause.* `adminCollector` teste l'intersection avec la bbox (`turf.bboxPolygon(ctx.bbox)`) au lieu de la zone tampon.
11. **Mineur. Le résumé de collecte et le rapport enregistré perdent les notes utiles.**
    - *Preuve.* Le résumé n'affiche que les 8 dernières lignes. Pour Yoff, on ne voit ni l'altitude, ni la population totale, ni WorldCover, ni GSW. Le rapport stocké dans `site.json` (`reports[]`) ne contient que `date` et `items`, sans les notes.
    - *Cause.* `.slice(-8)` dans `CollectDialog.tsx` (l. 181) ; les notes ne sont pas persistées.
12. **Mineur. Plusieurs objets collectés dépassent largement le site.**
    - *Preuve.* Un polygone `landuse=residential` couvre tout Dakar (bbox −17,53..−17,23). La voirie OSM de Fatick s'étend jusqu'à 3,7 km au nord du tampon.
    - *Cause.* `clipToArea` garde les objets entiers. C'est sans effet sur la synthèse, qui découpe, mais les couches s'alourdissent et les exports montrent des objets hors cadre.
13. **Mineur. L'export CSV est peu lisible dans un tableur français.**
    - *Preuve.* Séparateur `;`, mais décimales avec un point (`0.4644`, `221.9`). Les équipements combinent nombre et distance dans une seule cellule (`"1;135"`). La ligne « Autres » vaut toujours 0, parce qu'`amenityFamily` ne renvoie jamais `autre`.
    - *Cause.* `synthesisCsv` et `synthesisRows` (`lib/analysis.ts`).
14. **Remarque sur les données.** La densité WorldPop de la Médina (222 hab./ha sur l'emprise, au plus 289 par carreau) est vraisemblablement inférieure à la réalité, plutôt 400 à 500 hab./ha. La valeur est fidèle au GeoTIFF : la limite vient de la source, pas de l'application. Le CES de 46 % calculé avec Google est probablement sous-estimé lui aussi pour un tissu continu. Ces deux réserves sont à mentionner sur les planches.

---

# Deuxième passage : après corrections

Contrôle fait le 4 novembre 2026, après la reconstruction du serveur. Le coordinateur a annoncé huit corrections : synthèse et CSV, sauvegarde après collecte, WorldPop, niveaux, tampon, OSM, limites administratives, résumé de collecte.

## Méthode

- **Collecte.** Elle a été relancée sur les trois sites depuis l'interface (« Relancer »), avec toutes les sources cochées. J'ai suivi chaque PUT envoyé par le navigateur et interrogé `GET /api/sites/<slug>` toutes les 200 ms après « Fermer ».
- **Interface.** J'ai refait sur chaque site les synthèses des zones `emprise` et `tampon` et la comparaison emprise / tampon, en relevant le tableau **et** le CSV exporté. Sur la Médina, j'ai refait les mesures « m » et « s ».
- **Recalculs.** Les scripts du premier passage ont été relancés. La zone « emprise + tampon » de la synthèse est maintenant le tampon à 64 pas par quart de cercle (261 sommets, `lib/site.ts`). Je l'ai reconstruite avec le même appel `turf.buffer` pour la recalculer.

## Accès réseau et sources

- Médina : Overpass injoignable sur les quatre miroirs (délai de 20 s), donc **repli sur l'API OSM 0.6**. Le repli a donné les mêmes nombres d'objets qu'Overpass : 366 bâtiments, 114 voies, 28 équipements, et 44 points d'intérêt au lieu de 42.
- Yoff : Overpass (overpass-api.de). Fatick : Overpass (maps.mail.ru).
- Aucune source en échec. Durées de collecte, sites lancés l'un après l'autre : Médina 93 s, Yoff 91 s, Fatick 68 s.

## Contrôles ciblés

| Point corrigé | Résultat | Preuve |
|---|---|---|
| 1. Synthèse et CSV aux lignes fixes | ✅ corrigé | 40 lignes identiques pour les deux zones, dans le même ordre : toutes les classes de voirie (0 m si absente), nombre et distance sur deux lignes par famille, plus de ligne « Autres ». Médina : chemin piéton 0 m / 91 m, linéaire total 2 557 / 12 540 m, population 1 985 / 9 369. Le CSV utilise le séparateur « ; » et la virgule décimale (`0,4644` ; `221,9`). Mêmes constats à Yoff et à Fatick. |
| 2. Seul `site.json` est réenregistré après une collecte | ✅ corrigé | Un seul PUT de `site.json` (environ 25 Ko), envoyé 1,3 s après la fin de la collecte, et **aucun PUT de couche**. `site.json` contient bien les 22 couches dès « Fermer » : vu au premier sondage, 0,01 s après. Au premier passage, il fallait réexpédier 13,4 Mo. |
| 3. WorldPop : tous les carreaux qui recoupent la zone | ✅ corrigé | Population de la synthèse comparée à une pondération exacte sur le GeoTIFF, avec le tampon de 261 sommets : Médina 9 369 / 9 369, Yoff 85 517 / 85 518, Fatick 36 362 / 36 362 (≤ 0,001 %). Les écarts étaient de −2,6 %, −0,5 % et −2,2 % au premier passage. Carreaux : Médina 70 (59 avant), Yoff 1 000 (962), Fatick 568 (524), toujours identiques au GeoTIFF. |
| 4. Niveaux repris d'OSM et d'Overture | ✅ corrigé | Recalcul : bâtiments Google dont le centroïde tombe dans un bâtiment OSM ou Overture qui a des niveaux. Yoff tampon : 28 / 28, plancher renseigné 48 230 m² (recalcul 48 327 m², −0,2 %). Yoff emprise : 3 / 3, 1 303 / 1 303 m². Médina tampon : 3 / 3, 273 / 273 m². Fatick : 0, faute de niveaux dans les sources. Les sources de la synthèse mentionnent « (niveaux) ». |
| 5. Tampon à 256 sommets | ⚠️ partiel | La **zone d'analyse** et l'onglet Site utilisent le nouveau tampon de 261 sommets : Médina 45,44 ha (454 404 m²) au lieu de 454 215. En revanche, la **couche « Zone tampon » des sites existants n'est pas régénérée** : `layers/tampon.geojson` et la carte ont toujours 69 sommets, aussi bien dans le fichier que dans `__store`. Le tampon affiché et la zone calculée diffèrent donc légèrement (+0,04 % en surface). Voir le défaut R1. |
| 6. OSM : bâti exclu de l'occupation du sol, grands polygones découpés | ✅ corrigé | Plus aucun `osm_id` commun entre `osm-occupation` et `osm-batiments`. Occupation du sol, espaces verts et eau : 0 % d'objets hors tampon. Le polygone « residential » couvrant tout Dakar est maintenant découpé (bbox −17,4472..−17,4442 à la Médina). Les « restaurant » et « fuel » qui restent sont des surfaces non bâties (aires d'activité). |
| 7. Limites administratives | ✅ corrigé | Fatick : Fatick (région), Fatick (département) et Tattaguine. **Niakhar n'y est plus.** Médina : Dakar, Dakar, Plateau. Yoff : Dakar, Dakar, Almadies, Parcelles Assainies. Toutes recoupent le tampon. |
| 8. Résumé de collecte | ✅ corrigé (affichage) | Les 12 à 13 notes sont affichées : surface de collecte, population, eau, altitude, Sentinel-2, WorldCover, voie d'accès OSM. Mais le rapport enregistré (`reports[]`) ne contient toujours que `date` et `items`, sans les notes : défaut R2. |

## Non-régression : positions et mesures

- **Positions.**
  - Toutes les couches vectorielles recoupent toujours le tampon à 100 %, sans décalage ni inversion.
  - Les nombres d'objets ne changent pas, sauf l'occupation du sol (bâti retiré) et WorldPop (carreaux de bord ajoutés).
  - Recouvrement : centroïdes OSM dans Google 74,6 / 82,5 / 59,3 %, IoU médiane de 0,44 à 0,49, décalage moyen ≤ 2,1 m : identiques au premier passage.
  - Courbes de niveau : écart médian au MNS de 0,018 / 0,015 / 0,008 m, inchangé. Sentinel-2 et WorldCover : mêmes bornes et mêmes couvertures.
- **Mesures.**

| Grandeur | Application | Recalcul UTM | Recalcul géodésique | Écart app / géodésique |
|---|---|---|---|---|
| Médina, surface de l'emprise | 89 465 m² | 89 464,9 | 89 383,0 | +0,09 % |
| Médina, surface avec tampon (zone de 261 sommets) | 454 404 m² | 454 403,7 | 453 987,4 | +0,09 % |
| Médina, distance « m » | 333,4 m | 333,36 | 333,21 | +0,06 % |
| Médina, surface « s » | 42 155 m² | 42 154,8 | 42 116,2 | +0,09 % |
| Médina, périmètre « s » | 832,8 m | 832,78 | 832,39 | +0,05 % |
| Médina tampon : surface bâtie | 187 376 m² | 187 376,0 | 187 204,3 | +0,09 % |
| Médina tampon : linéaire de voirie | 12 540 m | 12 540,3 | 12 534,5 | +0,05 % |
| Yoff, surface avec tampon | 11 644 896 m² | 11 644 895,6 | 11 633 641,6 | +0,10 % |
| Yoff emprise : nombre de bâtiments, surface bâtie | 13 321 ; 1 327 861 m² | 13 321 ; 1 327 861,4 | 1 326 582,7 | +0,10 % |
| Yoff tampon : linéaire de voirie | 185 972 m | 185 972,6 | 185 883,2 | +0,05 % |
| Fatick, surface avec tampon | 4 355 657 m² | 4 355 657,3 | 4 356 643,6 | −0,02 % |
| Fatick tampon : surface bâtie | 598 462 m² | 598 462,2 | 598 598,6 | −0,02 % |
| Fatick tampon : linéaire de voirie | 86 370 m | 86 370,2 | 86 380,0 | −0,01 % |
| Fatick tampon : surfaces en eau | 70 946 m² | 70 944,6 | — | 0 |

Toutes les valeurs restent sous la tolérance de 0,5 %. Les équipements, espaces verts et populations sur l'emprise sont identiques au premier passage et au recalcul.

## Défauts restants

- **R1. Mineur. La couche « Zone tampon » des sites existants n'est pas régénérée.**
  - *Preuve.* `layers/tampon.geojson` des trois sites et `__store.getState().data.tampon` ont toujours 69 sommets. La zone d'analyse et l'onglet Site utilisent 261 sommets (Médina 454 215 contre 454 404 m²).
  - *Cause.* Le fichier n'est réécrit que si la distance ou l'emprise change (`PUT /api/sites/<slug>`), ni à la collecte ni au chargement.
- **R2. Mineur. Les notes de collecte ne sont pas enregistrées dans le rapport.**
  - *Preuve.* `site.json`, `reports[-1]` n'a que les clés `date` et `items`. L'onglet Site (« Dernière collecte ») ne peut donc pas les réafficher.
- **R3. Mineur. Petit écart sur le plancher renseigné.**
  - *Preuve.* À Yoff (tampon), l'application trouve 48 230 m² et le recalcul 48 327 m² (−0,2 %), avec le même nombre de bâtiments (28).
  - *Cause probable.* Quand plusieurs sources se recouvrent, la règle qui choisit le niveau retenu ou le point testé diffère légèrement du recalcul. L'écart reste sous la tolérance.
- **Non traités volontairement, toujours constatés :**
  - pas de filtre de confiance Google (19 à 23 % des empreintes < 0,70, recouvrements de 0,5 %) ;
  - lieux Overture empilés sur des centroïdes fictifs ;
  - voirie OSM et Overture gardée entière, jusqu'à 3,7 km au-delà du tampon à Fatick.
- **Pour information :**
  - les calculs restent plans en UTM 28N (+0,1 % à Dakar), sous la tolérance ;
  - la densité WorldPop de la Médina (222 hab./ha) est probablement sous-estimée par la source elle-même.
