# Rapport final — Chuilacarte

Rapport final, rédigé le 04/11/2026.

## Ce qui est fait

Les dix étapes de la spécification, dans l'ordre :

1. **Socle** : Next.js 15 + MapLibre 5 + Terra Draw + Turf + DuckDB spatial ; sites stockés en fichiers (`data/sites/<site>/`) ; création par recherche (Nominatim), dessin ou import ; écran d'accueil avec vignettes, renommer / dupliquer / supprimer ; fonds clair, couleur, sombre (OpenFreeMap), OSM, satellite Esri (avec clé), Sentinel-2 du site, relief (ombrage + courbes), papier, blanc ; import GeoJSON, KML/KMZ, GeoPackage, Shapefile zippé, CSV, DXF.
2. **Sources** vérifiées par agent (`SOURCES.md`) puis **collecte** de 9 sources sur l'emprise + tampon, avec résumé par couche et raisons d'échec.
3. **Couches** : panneau (visibilité, ordre, opacité, renommer, supprimer, filtre attributaire), styles simple / catégorisé / gradué / chaleur, hachures, symboles, étiquettes, bibliothèque de styles, table attributaire modifiable, édition (sommets, déplacement, découpe, fusion, rotation, échelle).
4. **Annotations** (points, lignes, polygones, rectangles, cercles, flèches, textes, repères numérotés avec légende, cotations, croquis) et **mesures** (distance, surface, périmètre en UTM).
5. **Mise en page** (A4 à A0 ou libre, échelle exacte, habillage complet, modèles) et **exports** PNG 300 dpi, PDF vectoriel, SVG, GeoJSON, GeoPackage, DXF — contrôle cartographique par agent.
6. **Pont QGIS** (GeoPackage + projet `.qgs` stylé + images calées ; retour par import) — contrôle de compatibilité par agent dans QGIS 3.34.
7. **Analyses** : synthèse d'une zone et comparaison de deux zones, CSV, profil, isochrones, tampons, chaleur, densité — test des données par agent sur la Médina, Yoff et Fatick.
8. **Implantation** : plan DXF et image calés (déplacement, rotation, échelle, 2-3 points), calculs CES / COS, 3D, ombres portées.
9. **Test de bout en bout** par agent (Playwright, `tests/e2e/bout-en-bout.ts`). Après correction des défauts relevés : 39 étapes sur 39 OK, 0 erreur dans la console du navigateur et le terminal du serveur.
10. **Documentation** : `README.md`, `SOURCES.md`, `DECISIONS.md`, ce rapport, `exemples/`.

## Contrôles

Chaque contrôle a été fait par un agent distinct de celui qui avait écrit le code. Les défauts relevés ont été corrigés, puis le contrôle a été repassé.

| Contrôle | Rapport | Résultat |
|---|---|---|
| Sources | `SOURCES.md` | 9 sources intégrées, exclusions motivées (licences non commerciales, clés) |
| Données (Médina, Yoff, Fatick) | `exemples/CONTROLE_DONNEES.md` | 2 passages ; positions justes, mesures à moins de 0,1 % d'un calcul géodésique indépendant |
| Compatibilité QGIS (QGIS 3.34, PyQGIS) | `exemples/CONTROLE_QGIS.md` | 3 passages ; toutes les couches se chargent en UTM avec leurs styles ; DXF en mètres |
| Cartographie (exports regardés) | `exemples/CONTROLE_CARTOGRAPHIQUE.md` | 3 passages ; plus aucun bloquant ; échelle exacte à moins de 0,01 %, barre d'échelle exacte ; PNG A1 300 dpi en 16 s et 1,7 Go |
| Bout en bout (Playwright) | `exemples/CONTROLE_BOUT_EN_BOUT.md` | 39/39 étapes, 0 erreur |

Les planches d'exemple (PNG 300 dpi, PDF, SVG ; A4 à A1, du 1/1 000 au 1/10 000) sont dans `exemples/medina/`, `exemples/yoff/` et `exemples/fatick/`.

## Ce qui n'est pas fait / limites connues

**Non fait ou volontairement écarté**
- GHSL non intégré : redondant avec WorldPop + Google Open Buildings, et fichiers sans lecture partielle (voir `DECISIONS.md`).
- Imagerie haute résolution Esri seulement avec une clé `ARCGIS_API_KEY` ; mosaïque EOxCloudless seulement avec `ENABLE_NONCOMMERCIAL_SOURCES=true` (licence non commerciale).
- Isochrones sur le serveur public Valhalla de FOSSGIS (1 requête par seconde, service sans garantie) si aucune clé OpenRouteService n'est fournie.

**Limites des données**
- Relief : modèle de surface Copernicus GLO-30 (30 m), qui inclut bâti et végétation. Les courbes sont justes pour un plan de quartier, pas pour un plan masse au 1/500 ou au 1/1 000, qui demande un levé topographique.
- Bâti : Google Open Buildings est le plus complet à Dakar, mais ses empreintes, détectées par satellite, se chevauchent parfois. Les hauteurs et niveaux sont rarement connus : la surface de plancher repose alors sur une hypothèse affichée dans le tableau.
- Distance au plus proche équipement : en ligne droite depuis le centre de la zone, pas par le réseau.
- La collecte dépend de services en ligne. Overpass est souvent saturé, l'application se replie alors sur l'API OSM 0.6, plus lente. Hors ligne, les fonctions concernées renvoient un message clair.

**Limites des exports cartographiques** (défauts mineurs restants, voir le 3e passage du contrôle cartographique)
- Toponymie limitée : les noms viennent du fond OpenFreeMap (peu de noms de rues dans les villes moyennes comme Fatick), et les équipements ne sont pas étiquetés par défaut (l'étiquette par attribut se règle dans l'onglet Couche).
- Le placement des noms de rues est celui des tuiles OpenFreeMap : il peut être légèrement décalé par rapport aux voies OSM du site aux grandes échelles.
- Encart de situation sommaire : contour du Sénégal et des régions, sans pays voisins ni océan.
- Points d'équipement proches qui se superposent (pas de déplacement automatique).
- Les étiquettes du fond restent en image (200 à 300 dpi) dans les PDF et SVG ; choisir le fond « Papier (fond uni) » pour un export 100 % vectoriel.
- SVG : les polices ne sont pas incluses (Inter, IBM Plex Sans, Jost et Source Serif 4 sont à installer pour retravailler dans Illustrator ; elles sont dans `public/fonts/`). PDF : polices déclarées en Identity-H (avertissement de poppler sans conséquence).

**Limites fonctionnelles**
- Un GeoPackage exporté puis réimporté revient en plusieurs couches pour les couches mixtes (une table par type de géométrie, comme à l'export).
- L'export GeoJSON produit un fichier par type de géométrie pour les couches mixtes.
- Une seule exportation PNG à la fois (limite volontaire, pour la mémoire).
- Pensé pour l'ordinateur ; pas d'adaptation aux tablettes.
