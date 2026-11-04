# Rapport final — Chuilacarte

_Brouillon, complété à la fin du test de bout en bout._

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
9. **Test de bout en bout** par agent.
10. **Documentation** : `README.md`, `SOURCES.md`, `DECISIONS.md`, ce rapport, `exemples/`.

## Contrôles

Voir `exemples/CONTROLE_CARTOGRAPHIQUE.md`, `exemples/CONTROLE_QGIS.md`, `exemples/CONTROLE_DONNEES.md`, `exemples/CONTROLE_BOUT_EN_BOUT.md`.

## Ce qui n'est pas fait / limites connues

(à compléter)
