# Chuilacarte — plateforme cartographique personnelle — spécification pour Claude Code

## Mode de travail

Développe Chuilacarte entièrement, du début à la fin, en autonomie. Ne me demande aucune validation en cours de route. Quand un choix n'est pas précisé ici, prends la décision la plus simple et la plus robuste, et note-la en une ligne dans `DECISIONS.md`.

Commit et pousse après chaque étape terminée, pour que rien ne soit perdu si la session s'interrompt.

Utilise des sous-agents pour contrôler le travail (voir « Contrôle par agents »). Un agent qui contrôle ne doit pas être celui qui a produit le travail contrôlé. Corrige tout ce qu'ils relèvent et fais-les repasser jusqu'à ce qu'il n'y ait plus de problème.

Le périmètre est large. Respecte l'ordre des étapes : chaque étape doit être complète, testée et commitée avant de passer à la suivante. Si tu manques de temps, je préfère un socle solide qui fonctionne parfaitement à beaucoup de fonctions à moitié faites.

## Contexte

Je suis architecte et urbaniste à Dakar. Je travaille régulièrement sur des sites précis (parcelles, quartiers, villes moyennes du Sénégal) et j'ai besoin d'un outil personnel pour :
- récupérer rapidement les cartes et le maximum de données disponibles sur un site ;
- manipuler ces cartes, les annoter, les légender ;
- produire des cartes de très bonne qualité graphique, utilisables dans des rendus d'architecture et d'urbanisme ;
- faire des analyses urbaines ;
- implanter mes projets sur le site ;
- travailler en aller-retour avec QGIS, que j'utilise déjà.

Je ne veux pas une copie de QGIS dans le navigateur. Je veux un outil plus rapide que QGIS pour les tâches courantes (préparer un site, collecter les données, faire une belle carte, mesurer, implanter), et un pont propre vers QGIS pour les traitements avancés.

L'app tourne en local sur mon Mac et je l'utilise dans le navigateur. Pas de mise en ligne, pas de comptes.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, lancé avec `npm run dev`.
- Carte : MapLibre GL JS.
- Dessin et édition de géométries : Terra Draw (ou équivalent maintenu et compatible MapLibre, note ton choix).
- Analyses géométriques côté client : Turf.js.
- Traitements de données côté serveur (routes API Next.js) : DuckDB avec l'extension spatial. Elle lit GeoParquet (Overture), GeoPackage, Shapefile, KML, DXF et écrit en GeoPackage, ce qui évite d'installer GDAL séparément. Si une conversion n'est pas possible avec DuckDB, utilise GDAL (`ogr2ogr`) en le documentant dans le README comme dépendance optionnelle (`brew install gdal`).
- Stockage : un dossier par site dans `data/sites/<slug>/` contenant un `site.json` (emprise, paramètres, styles, annotations, mises en page) et les couches en GeoJSON ou GeoPackage. Pas de base de données serveur.
- Clés d'API : uniquement dans `.env.local`, avec un `.env.example`. Priorité absolue aux sources qui ne demandent pas de clé. Une fonction qui dépend d'une clé absente doit être désactivée proprement avec un message clair, jamais planter.
- Système de coordonnées : stockage en WGS84 (EPSG:4326). Pour les mesures et les exports vers QGIS, gère aussi la projection UTM zone 28N (EPSG:32628), qui couvre Dakar et l'ouest du Sénégal, et choisis automatiquement la zone UTM adaptée au site.

## Notion centrale : le « site »

Tout part d'un site d'étude. Je crée un site en :
- cherchant un lieu par son nom (géocodage) ;
- ou dessinant une emprise (rectangle, polygone) sur la carte ;
- ou important un fichier (GeoJSON, KML, GeoPackage, Shapefile zippé, DXF).

Je peux ajouter une zone tampon autour de l'emprise (ex. 500 m, 1 km) pour l'analyse du contexte.

Un écran d'accueil liste mes sites avec une vignette, et je peux en dupliquer, renommer ou supprimer.

## 1. Collecte de données sur un site

Un bouton « Collecter les données » qui, pour l'emprise du site (avec sa zone tampon), récupère et enregistre comme couches du site les données suivantes. Chaque couche garde sa source, sa licence, sa date de collecte, et l'attribution s'affiche dans la carte et sur les exports.

Sources à intégrer (vérifie d'abord que chacune fonctionne et que ses conditions d'utilisation permettent cet usage personnel ; n'intègre que celles qui sont conformes, et explique les exclusions dans `SOURCES.md`) :

- **OpenStreetMap via l'API Overpass** : bâti, voirie hiérarchisée, chemins de fer, hydrographie, occupation du sol, espaces verts, équipements (écoles, santé, cultes, marchés, administrations, transport), points d'intérêt. Respecte les règles d'usage de l'API (requêtes raisonnables, User-Agent identifié).
- **Overture Maps** (GeoParquet, lu avec DuckDB) : bâtiments, lieux, réseau de transport, en complément d'OSM.
- **Google Open Buildings** : empreintes de bâtiments détectées par satellite, avec indice de confiance. Particulièrement utile au Sénégal où OSM est incomplet dans beaucoup de quartiers.
- **Limites administratives** : geoBoundaries (régions, départements, communes du Sénégal).
- **Relief** : modèle numérique de terrain (Copernicus DEM GLO-30 ou les AWS Terrain Tiles), pour courbes de niveau, ombrage et profils.
- **Population et bâti** : WorldPop et/ou GHSL (Global Human Settlement Layer), pour estimer la population et l'emprise bâtie dans une zone.
- **Eau** : JRC Global Surface Water (présence et variations de l'eau), utile pour les zones inondables autour de Dakar.
- **Imagerie satellite** : Sentinel-2 via le STAC du Microsoft Planetary Computer ou Copernicus Data Space, pour obtenir une image récente et peu nuageuse du site, et comparer plusieurs dates.

Ajoute toute autre source ouverte que tu juges importante pour l'architecture et l'urbanisme en Afrique de l'Ouest, si elle est fiable et simple à intégrer, en la documentant dans `SOURCES.md`.

Pour chaque collecte, affiche un résumé : nombre d'objets par couche, sources qui ont échoué et pourquoi.

## 2. Fonds de carte

Sélecteur de fonds de carte, sans clé si possible :
- fond vectoriel clair et fond sombre (OpenFreeMap ou Protomaps) ;
- OSM standard ;
- imagerie satellite haute résolution (une source dont les conditions autorisent l'affichage avec attribution, à vérifier) ;
- l'image Sentinel-2 récupérée pour le site ;
- ombrage du relief et courbes de niveau générées à partir du MNT ;
- un fond « papier » très épuré (fond uni, sans étiquettes), pensé pour les rendus d'architecte.

## 3. Manipulation des couches

- Panneau des couches : afficher/masquer, ordre par glisser-déposer, opacité, renommer, supprimer, filtrer par attribut (ex. bâtiments de plus de 3 niveaux, équipements de santé seulement).
- Style par couche : couleur de remplissage et de contour, épaisseur, motif de hachures, taille et symbole des points, étiquettes à partir d'un attribut, style catégorisé (une couleur par valeur) et gradué (classes sur une valeur numérique).
- Bibliothèque de styles prédéfinis sobres et professionnels, cohérents entre eux, inspirés des conventions graphiques des plans d'urbanisme (bâti en gris foncé, voirie hiérarchisée, végétation, eau, équipements par famille).
- Table attributaire : consulter, trier, modifier les attributs d'un objet.
- Import de mes propres fichiers comme couches : GeoJSON, KML, GeoPackage, Shapefile zippé, CSV avec colonnes de coordonnées, DXF.
- Éditer, déplacer, découper et fusionner des géométries.

## 4. Annotation

- Dessiner points, lignes, polygones, cercles, flèches.
- Textes libres positionnés sur la carte, avec choix de taille, graisse et couleur.
- Repères numérotés avec légende associée (1, 2, 3… renvoyant à une liste).
- Cotations : mesure de longueur affichée sur la carte.
- Croquis à main levée.
- Les annotations sont une couche comme les autres, éditable et exportable.

## 5. Mesures et analyses urbaines

- Mesure de distance, de surface et de périmètre (calculées dans la projection métrique du site).
- Profil topographique le long d'une ligne dessinée.
- Zones tampons autour de n'importe quel objet.
- Isochrones à pied, à vélo et en voiture depuis un point (OpenRouteService si une clé est fournie, sinon un service public sans clé si disponible et conforme ; sinon fonction désactivée proprement).
- Pour une zone donnée (le site, un îlot, un polygone dessiné), un tableau de synthèse :
  - surface totale, surface bâtie, emprise au sol (rapport bâti / surface), nombre de bâtiments, surface moyenne des bâtiments ;
  - estimation de surface de plancher et de densité quand des hauteurs ou des niveaux sont disponibles ;
  - linéaire de voirie par type, densité de voirie ;
  - nombre et types d'équipements, distance au plus proche équipement de chaque famille ;
  - population estimée et densité de population ;
  - part d'espaces verts et de surfaces en eau.
- Carte de chaleur et carte de densité sur n'importe quelle couche de points.
- Comparaison de deux zones côte à côte.
- Export du tableau de synthèse en CSV.

## 6. Implantation de projets

- Importer un plan de projet en DXF (export AutoCAD) ou dessiner une emprise de projet.
- Caler le plan sur la carte : le déplacer, le tourner, le mettre à l'échelle, ou le géoréférencer à partir de deux ou trois points de calage (je clique un point sur le plan, puis le point correspondant sur la carte).
- Importer une image (plan scanné, esquisse) et la caler de la même façon, avec réglage de transparence.
- Vue 3D : extrusion du bâti existant (à partir des hauteurs ou du nombre de niveaux quand ils existent, sinon une hauteur par défaut réglable) et de mon projet avec une hauteur que je fixe, pour juger l'insertion dans le contexte.
- Ombres portées : simulation de la position du soleil à Dakar pour une date et une heure choisies, et affichage des ombres du projet et du bâti voisin.
- Calcul automatique pour le projet : emprise, surface de plancher selon le nombre de niveaux, rapport à la parcelle.

## 7. Mise en page et exports de qualité

C'est essentiel : les cartes doivent pouvoir aller directement dans mes planches de rendu.

- Mode « mise en page » : format (A4, A3, A1, A0, ou format personnalisé), orientation, échelle exacte choisie (1/500, 1/1000, 1/2000, 1/5000, 1/10000, 1/25000, ou libre), marges.
- Éléments ajoutables et déplaçables : titre, sous-titre, légende générée automatiquement à partir des couches visibles et modifiable, barre d'échelle, flèche du nord, cartouche (nom du projet, auteur, date, échelle, sources), encart de situation (petite carte du Sénégal ou de la région avec la position du site), texte libre, logo.
- Typographie soignée, choix de quelques polices adaptées aux rendus d'architecture.
- Exports :
  - PNG haute résolution (300 dpi au format choisi) ;
  - PDF vectoriel quand c'est possible ;
  - SVG, pour retravailler la carte dans Illustrator ;
  - GeoJSON et GeoPackage des couches ;
  - DXF des couches vectorielles, pour les reprendre dans AutoCAD, en projection métrique.
- Les attributions des sources apparaissent automatiquement sur les exports.
- Modèles de mise en page enregistrables et réutilisables.

## 8. Pont avec QGIS

- **Export vers QGIS** : un bouton qui produit un dossier contenant un GeoPackage avec toutes les couches du site (en projection métrique du site) et un projet QGIS (`.qgz` ou `.qgs`) qui charge ces couches avec des styles aussi proches que possible de ceux de Chuilacarte, dans le bon ordre, et le fond de carte en couche XYZ.
- **Import depuis QGIS** : importer un GeoPackage ou des couches exportées de QGIS dans un site existant.
- Documente dans le README comment faire l'aller-retour.

## Interface

- Sobre, rapide, entièrement en français.
- Disposition classique d'outil cartographique : carte au centre, panneau des couches à gauche, panneau de propriétés et d'analyse à droite, barre d'outils en haut.
- Raccourcis clavier pour les outils fréquents.
- Annuler / rétablir.
- Sauvegarde automatique du site.
- Mode sombre.
- Pensé pour l'écran d'ordinateur en priorité.

## Contrôle par agents

Lance ces agents à la fin des étapes concernées. Chacun reçoit seulement ce dont il a besoin pour contrôler.

**Agent de vérification des sources.** Avant d'intégrer les sources, il vérifie pour chacune : que l'API ou le jeu de données est accessible, qu'il couvre bien Dakar, et que la licence et les conditions d'utilisation autorisent un usage personnel avec attribution. Il produit `SOURCES.md` (source, ce qu'elle apporte, licence, attribution exacte à afficher, limites d'usage, clé requise ou non) et la liste des sources exclues avec la raison.

**Agent de test des données.** Il crée trois sites de test : un îlot de la Médina à Dakar, le quartier de Yoff, et le centre-ville de Fatick. Pour chacun, il lance la collecte et vérifie que chaque couche contient des données plausibles, bien positionnées (pas de décalage, pas d'inversion latitude/longitude), et que les mesures de surface et de distance sont justes en les recalculant indépendamment.

**Agent de contrôle cartographique.** Il produit des exports PNG et PDF de mise en page pour les trois sites, à plusieurs échelles, puis il ouvre réellement chaque image et la regarde. Il vérifie : lisibilité, légende complète et cohérente avec la carte, barre d'échelle exacte par rapport à l'échelle annoncée, flèche du nord, attributions présentes, absence d'éléments qui se chevauchent, qualité graphique au niveau d'un rendu professionnel. Il liste les défauts à corriger.

**Agent de compatibilité QGIS.** Il installe QGIS dans l'environnement (paquets Ubuntu) et ouvre les projets exportés en mode sans interface (PyQGIS ou `qgis_process`) pour vérifier que toutes les couches se chargent, dans la bonne projection, avec leurs styles. Il vérifie aussi que l'export DXF s'ouvre avec une bibliothèque de lecture DXF et que les coordonnées sont en mètres.

**Agent de test de bout en bout.** Avec Playwright, il utilise l'app comme moi : créer un site par recherche, par dessin et par import, collecter les données, styler les couches, annoter, mesurer, lancer chaque analyse, importer et caler un DXF de test, passer en 3D, simuler les ombres, faire une mise en page et l'exporter dans tous les formats, exporter vers QGIS. Aucune erreur dans la console du navigateur ni dans le terminal. Il supprime ses données de test à la fin.

## Ordre de travail

1. Socle : app, carte MapLibre, fonds de carte, création et liste des sites, stockage, import de fichiers.
2. Vérification des sources par agent, puis collecte des données sur un site.
3. Panneau des couches, styles, table attributaire, édition.
4. Annotation et mesures.
5. Mise en page et exports PNG, PDF, SVG, GeoJSON, GeoPackage, DXF, puis contrôle cartographique par agent.
6. Pont QGIS, puis contrôle de compatibilité par agent.
7. Analyses urbaines et tableau de synthèse, puis test des données par agent.
8. Implantation de projets : calage DXF et image, 3D, ombres.
9. Test de bout en bout par agent, corrections jusqu'à ce que tout passe.
10. README et rapport final.

## Livraison

- `README.md` : installation, lancement, dépendances optionnelles, clés d'API facultatives et comment les obtenir, guide rapide de chaque fonction, aller-retour avec QGIS.
- `SOURCES.md` : les sources intégrées et exclues, avec licences et attributions.
- `DECISIONS.md` : les choix que tu as faits toi-même.
- Un dossier `exemples/` avec les exports produits par l'agent de contrôle cartographique pour les trois sites de test.
- Un rapport final court : ce qui est fait, ce qui ne l'est pas, les limites connues.
