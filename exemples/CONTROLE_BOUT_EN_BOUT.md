# Contrôle de bout en bout (Playwright)

## Passage après corrections (04/11/2026)

Le script de l'agent (`tests/e2e/bout-en-bout.ts`) a été relancé tel quel sur un build reconstruit (`scripts/test-server.sh 3500`) après les corrections. Résultat : **39 étapes sur 39 OK**, **0 erreur** dans la console du navigateur et dans le terminal du serveur. La seule erreur relevée est attendue : HTTP 400 d'un test négatif, le DXF local refusé par « Importer ». Les données de test ont été supprimées.

| Défaut | Correction | Vérification |
|---|---|---|
| D1 Maj + clic ne sélectionne pas | Zoom par boîte de MapLibre désactivé (`boxZoom: false`, `lib/mapbase.ts`) | Étape 3.6 : « Maj + clic : 2 objet(s) sélectionné(s) », fusion 2 → 1 |
| D2 Choix d'un projet → onglet Couche | `selectLayer(id, { keepTab: true })` depuis le panneau Projet | Étape 7.7 : onglet actif « projet » |
| D3 Profil hors ligne : HTTP 500 | Erreurs réseau → HTTP 503 « Service distant injoignable : vérifiez la connexion internet », une ligne sans trace dans le terminal (`jsonError`) ; message des isochrones corrigé | Revue du code (coupure réseau non reproduite) |
| D4 Nom du tampon non mis à jour | Nom et libellé de légende mis à jour dans la même modification | — |
| D5 Point décimal | `fmtNum` (fr-FR) : profil, ombres, calage, notes de collecte, taille des exports | Étape 7.6 : « hauteur 33,3° … 15,2 m » |
| D6 Avertissement « found null » | Styles OpenFreeMap nettoyés : cartouches de routes retirés, comparaisons numériques protégées par `to-number` (`sanitizeStyle`) | 0 occurrence sur le parcours |
| D7 Ordre « (10, 5 min) » | Minutes triées | Couche « Isochrones à pied (5, 10 min) » |

Non corrigé (mineur, assumé) : l'export GeoJSON produit un fichier par type de géométrie pour les couches mixtes (22 fichiers pour 15 couches), afin que chaque fichier reste homogène pour QGIS et les logiciels de DAO.


Date : 4 novembre 2026. Build de production servi sur http://localhost:3500 (`scripts/test-server.sh 3500`), Chromium 1248 sans interface, fenêtre de 1680 × 1050, macOS.

Script : `tests/e2e/bout-en-bout.ts`, lancé avec `npx tsx tests/e2e/bout-en-bout.ts [url]`. Il passe par l'interface : clics sur la carte et les panneaux, raccourcis clavier, glisser-déposer, boîtes `prompt` et `confirm`, téléchargements. `window.__store` et `window.__map` servent à vérifier les états et à cadrer la vue (`jumpTo`). Ils remplacent l'interface une seule fois, voir 3.6.

Les fichiers téléchargés, les captures, `resultats.json` (étapes, erreurs, évènements) et les journaux des passages sont dans `/private/tmp/claude-501/chuilacarte-e2e/`.

Quatre passages complets ont été faits. Les deux premiers ont servi à corriger le script. Le troisième a été perturbé par une coupure réseau sur la machine de test. **Le passage de référence est le 4ᵉ : 37 étapes OK sur 39, 0 erreur dans la console du navigateur, 0 ligne ajoutée au journal du serveur, toutes les données de test supprimées.**

Remarque : un autre agent (contrôle cartographique, sites `exemple-*`) travaillait en même temps sur le même serveur. Ses sites n'ont pas été touchés. Pendant le passage de référence, le journal du serveur n'a reçu aucune nouvelle ligne.

## Résultats par étape (passage de référence)

| Étape | Résultat | Constats |
|---|---|---|
| 1.1 Site créé par recherche « Médina, Dakar » | OK | 3 résultats Nominatim. Le contour de la commune devient l'emprise (2,34 km²), avec un tampon de 250 m. |
| 1.2 Site créé par dessin (rectangle) | OK | Rectangle de 223 × 186 m dessiné dans la Médina (4,15 ha), tampon de 100 m. |
| 1.3 Site créé par import (`zone.geojson`) | OK | L'objet est aussi gardé comme couche « zone » (1 objet). |
| 1.4 Tampon modifié dans l'onglet Site (100 → 300 m) | OK, avec un défaut mineur | La géométrie est régénérée (14,4 → 54,8 ha). Le nom de la couche reste « Zone tampon (100 m) » jusqu'au rechargement (défaut D4). |
| 1.5 Accueil : vignette, renommer, dupliquer, supprimer | OK | Les vignettes PNG ne sont pas uniformes. Renommer, dupliquer (3 couches copiées) et supprimer fonctionnent (dossier effacé). |
| 2. Collecte, 9 sources | OK | 20 couches en 20 à 85 s, aucune source en échec : OSM 413 bâtiments, 16 voies, 15 équipements, 40 POI ; Overture 607 / 34 / 68 ; Google 868 ; geoBoundaries 3 ; courbes 8 ; WorldPop 28 carreaux ; WorldCover, JRC, Sentinel-2 (23/10/2026, 0,6 % de nuages). Le résumé donne le nombre d'objets et des notes par source. Voir la remarque R1. |
| 3.1 Import de chaque fixture comme couche | OK | GeoJSON, KML (lignes et points), GPKG UTM, Shapefile zippé, CSV (virgule décimale), DXF UTM : tous à la bonne position. `projet_local.dxf` passé par « Importer » est refusé avec un message clair qui renvoie vers l'implantation de projet (HTTP 400 attendu). |
| 3.2 Afficher/masquer, ordre, opacité, renommer | OK | La visibilité MapLibre passe à `none`. Le glisser-déposer réordonne aussi les couches sur la carte. |
| 3.3 Filtre attributaire | OK | `confiance > 0,742` affiche 431 / 868 objets, ce qui est exact. Le filtre est bien appliqué à MapLibre. |
| 3.4 Styles | OK | Simple, catégorisé, gradué (5 classes), hachures, étiquettes et bibliothèque (12 styles). |
| 3.5 Table attributaire | OK | Tri croissant et décroissant corrects. La cellule modifiée est enregistrée dans la couche. |
| 3.6 Édition de géométrie | **KO** | Sélection au clic, flèche ↑ (1,00 m), déplacement à la souris (26 m, forme intacte) et découpe (2 parties, surface conservée) fonctionnent. **Maj + clic ne sélectionne pas un 2ᵉ objet (défaut D1).** La fusion a donc été testée avec une sélection multiple posée par `__store` : elle est correcte (1 polygone, surface conservée). |
| 3.7 Annuler / rétablir | OK | Boutons, Ctrl+Z / Ctrl+Maj+Z et Cmd+Z / Cmd+Maj+Z fonctionnent. |
| 3.8 Sauvegarde automatique et rechargement | OK | Couches, styles, ordre et géométries sont identiques après rechargement. |
| 3.9 Mode sombre | OK | Appliqué et conservé après rechargement. |
| 4. Annotations | OK | Point, ligne, polygone, rectangle, cercle (avec `rayon_m`), flèche, texte, repères n° 1 et 2 (avec leur liste), cotation (longueur exacte à 2 % près) et croquis à main levée (23 sommets). La taille du texte se modifie dans le panneau. |
| 5. Mesures | OK | Distance : 173,1 m contre 173,1 m calculés indépendamment avec turf (écart −0,003 %). Surface : −0,27 %. Périmètre : −0,05 %. Ces écarts correspondent au facteur d'échelle UTM. « Garder sur la carte » fonctionne. |
| 6.1 Synthèse d'une zone + CSV | OK | 273 bâtiments, CES 45,1 %, 1 106 m de voirie, 1 082 hab. Le CSV (39 lignes, `;`) est valide. |
| 6.2 Comparaison de deux zones | OK | Emprise et zone dessinée « Zone E2E » sont affichées côte à côte. Le CSV de comparaison a 3 colonnes. |
| 6.3 Profil topographique | OK, avec un défaut mineur | 292,7 m, altitudes de 6,4 à 8,8 m, CSV produit. Les chiffres sont affichés avec un point décimal (défaut D5). |
| 6.4 Tampon autour d'un objet sélectionné | OK | Surface de 7 832 m² contre π·50² = 7 854 m². |
| 6.5 Isochrones (Valhalla, sans clé) | OK | 5 min = 40,8 ha, 10 min = 143,9 ha. |
| 6.6 Carte de chaleur et carte de densité | OK | La couche `heatmap` est créée. La densité donne 18 hexagones de 50 m. |
| 7.1 Plan DXF local : import, déplacement, rotation, échelle | OK | 4 objets (PARCELLE, BATIMENT, TEXTE). Déplacement à la souris, flèche → (0,998 m), rotation de 15° et échelle 1,5 (surface 613,7 m² pour 612 attendus). |
| 7.2 Calage par 2 puis 3 points | OK | 2 points : rotation 29,5° pour 30° attendus, échelle 1,002, écart 0,12 m. 3 points : rotation −20,3° pour −20° attendus, écart moyen affiché de 0,06 m. Les petits écarts viennent des clics arrondis au pixel. |
| 7.3 Calculs du projet | OK | Emprise 273 m² (272 attendus), plancher 1 363 m² pour 5 niveaux, parcelle 770 m², CES 35,4 %, COS 1,77. |
| 7.4 Image calée avec transparence | OK | L'image est servie. Une transparence de 60 % donne `raster-opacity` 0,4. L'échelle de 0,25 m/px donne 99,8 m de large. Calage 2 points : 79,9 m pour 80 m, écart de 0,16 m. |
| 7.5 Vue 3D | OK | Inclinaison de 55°. Le bâti OSM, Overture et Google est extrudé, ainsi que le plan du projet. |
| 7.6 Ombres portées | OK | 21/12 à 16:00 : soleil à 33,3° de hauteur, azimut 228°, ombres calculées. Le curseur et le cas « soleil sous l'horizon » fonctionnent. |
| 7.7 Dessiner l'emprise d'un projet | **KO** | L'emprise est dessinée (666 m²). **Choisir un projet dans la liste de l'onglet Projet bascule sur l'onglet Couche (défaut D2).** |
| 8.1 Mise en page | OK | Nouvelle planche en A3 paysage au 1/2000, avec logo, encart, sous-titre et texte libre ajoutés. |
| 8.2 Export PNG / PDF / SVG | OK | PNG de 4 961 × 3 508 px à 300 dpi en RVB (2,9 Mo). PDF d'une page avec en-tête `%PDF` (7,6 Mo). SVG valide avec 82 textes (3,1 Mo). |
| 8.3 Modèle de mise en page | OK | Enregistré puis supprimé par l'interface. |
| 8.4 Export GeoJSON / GeoPackage / DXF | OK | GeoJSON : zip de 21 fichiers, tous lisibles, en WGS84. GPKG : `application_id` GPKG, 17 tables en EPSG:32628, styles QGIS, s'ouvre avec better-sqlite3. DXF : section ENTITIES, 1 001 entités, X entre 235 782 et 236 714 (UTM 28N). |
| 8.5 Export QGIS | OK | Le zip contient `.gpkg` (32 tables), `.qgs` (38 couches, UTM), les images calées avec leur `.pgw` et `LISEZMOI.txt`. |
| 9. Erreurs console et serveur | OK | 0 erreur non attendue. La seule erreur relevée est l'erreur 400 volontaire du test négatif en 3.1. |
| 10. Nettoyage | OK | 1 site supprimé par l'accueil, 2 par l'API, la copie supprimée à l'étape 1.5, et le modèle supprimé. Il reste 0 site `E2E`. |

## Défauts

### D1. Maj + clic ne fait pas de sélection multiple, donc la fusion est inaccessible — important
- **Symptôme** : avec l'outil Sélection, Maj + clic sur un second objet de la même couche ne change rien. Le bouton « Fusionner » reste grisé (il faut au moins 2 objets) et la fusion ne peut pas être lancée depuis l'interface. « Séparer » puis refusionner, ou fusionner deux parcelles, est donc impossible.
- **Reproduction** : importer `zone.geojson`, sélectionner l'objet, faire « Découper », cliquer une des parties, puis Maj + clic sur l'autre.
- **Cause constatée** : avec Maj enfoncée, MapLibre n'émet pas l'évènement `click` (vérifié en écoutant `map.on('click')`). Le gestionnaire « zoom par boîte » (`boxZoom`, actif par défaut) intercepte Maj + mousedown, si bien que `handleMapClick` (`lib/tools.ts`) n'est jamais appelé. Aucun message d'erreur n'apparaît.
- **Fichiers probables** : `lib/mapbase.ts` (`createMap` : passer `boxZoom: false`, ou bien gérer la sélection sur `mouseup`) et `lib/tools.ts`.
- **Limite du test** : la fusion elle-même est correcte une fois la sélection multiple posée par `window.__store`.

### D2. Choisir un projet dans la liste de l'onglet Projet bascule sur l'onglet Couche — important (ergonomie)
- **Symptôme** : quand il y a plusieurs projets (plan DXF, image, emprise dessinée), choisir l'un d'eux dans la liste déroulante de l'onglet Projet fait disparaître le panneau Projet au profit de l'onglet Couche. Il faut revenir manuellement sur Projet pour voir le calage et les calculs.
- **Reproduction** : importer `projet_local.dxf` et une image, puis « Dessiner l'emprise ». Dans l'onglet Projet, choisir « Plan — projet_local » dans la liste.
- **Cause** : `components/ProjectPanel.tsx` (liste `project-select`) appelle `selectLayer(id)`, et `selectLayer` dans `lib/store.ts` force `rightTab: 'couche'`.

### D3. Profil topographique sans réseau : HTTP 500 « Erreur interne : fetch failed » — mineur
- **Symptôme** (observé au 3ᵉ passage, pendant une coupure réseau) : le profil affiche « Profil : Erreur interne : fetch failed ». La console affiche `Failed to load resource: the server responded with a status of 500 (Internal Server Error) (…/api/sites/<site>/profile)` et le terminal la trace `[chuilacarte] [TypeError: fetch failed] { [cause]: [Error [ConnectTimeoutError]: Connect Timeout Error (attempted addresses: 3.5.138.238:443, …, timeout: 10000ms)] … code: 'UND_ERR_CONNECT_TIMEOUT' }`.
- **Attendu** : une erreur 503 avec un message clair (« Modèle de terrain injoignable, vérifiez la connexion »), comme le fait la route des isochrones. On pourrait aussi réutiliser le MNT déjà téléchargé lors de la collecte.
- **Fichiers probables** : `app/api/sites/[slug]/profile/route.ts` et `readDem` dans `lib/server/collect/relief.ts`.
- Pendant la même coupure, les isochrones renvoient bien une 503, mais leur message (« Renseignez ORS_API_KEY… ») oriente à tort vers une clé alors que le problème est la connexion. La pile est aussi écrite dans le terminal (`app/api/isochrone/route.ts`). Gravité : mineur.

### D4. Nom de la couche tampon pas mis à jour à l'écran après « Appliquer » — mineur
- **Symptôme** : dans l'onglet Site, passer le tampon de 100 à 300 m régénère la géométrie, mais la couche s'appelle toujours « Zone tampon (100 m) » dans le panneau des couches et dans la légende. Le bon nom n'apparaît qu'après rechargement.
- **Cause** : le renommage est fait côté serveur dans `PUT /api/sites/[slug]` (`app/api/sites/[slug]/route.ts`), et le client recharge seulement la géométrie (`components/SitePanel.tsx`). Il faudrait aussi mettre à jour `name` et `legendLabel` dans le `commit` du client.

### D5. Profil : nombres affichés avec un point décimal — mineur
- **Symptôme** : on lit « altitude 6.4 à 8.8 m · dénivelé +5.0 / −6.3 m », alors que le reste de l'interface utilise la virgule (« 292,7 m »). C'est aussi le cas de l'info des ombres (« hauteur 33.3° ») et de certains libellés de collecte (« min 4.7 m », « 0.6 % nuages »).
- **Fichiers** : `ProfileChart` dans `components/AnalysisTools.tsx` (`toFixed`), `computeShadows` dans `lib/projectTools.ts`, et les messages dans `lib/server/collect/*`.

### D6. Avertissement MapLibre « Expected value to be of type number, but found null instead. » — mineur
- **Symptôme** : 3 avertissements (niveau `warning`, pas `error`) à chaque chargement du fond de carte, 30 au total sur le parcours. Ils apparaissent aussi dans l'aperçu de la boîte « Nouveau site ».
- **Fichiers probables** : une expression du style de base ou de ses surcharges (`lib/mapbase.ts`, `lib/basemaps.ts`) qui lit une propriété numérique absente sans `coalesce`.

### D7. Détails cosmétiques — mineur
- La couche d'isochrones s'appelle « Isochrones à pied (10, 5 min) » (ordre décroissant), dans `lib/analysisTools.ts`.
- L'export GeoJSON contient 21 fichiers pour 14 couches visibles non vides : les couches vides ou réparties par type de géométrie produisent des fichiers en plus.

## Remarques (pas des défauts de l'application)
- **R1. Collecte OSM** : aux passages 1 et 4, aucun miroir Overpass n'a répondu. La collecte est passée par le repli « API OSM 0.6 » (noté dans le résumé), avec un résultat identique. Aux passages 2 et 3, Overpass `maps.mail.ru` a répondu. Le repli fonctionne comme prévu.
- **R2. Passage 3** : une coupure réseau sur la machine de test (`ERR_NETWORK_CHANGED`, délais de connexion vers S3 et Valhalla) a fait échouer le profil et les isochrones. Les deux réussissent aux passages 2 et 4. Seule la qualité du message est en cause (D3).
- **R3. Limites du script** :
  - la vue est cadrée par `__map.jumpTo` ;
  - les couches qui recouvrent l'îlot à éditer sont masquées par `__store` pour pouvoir cliquer dessus ;
  - la sélection multiple de 3.6 est posée par `__store`, parce que Maj + clic est en défaut (D1) ;
  - les cibles de calage sont cliquées au pixel près (écarts inférieurs à 0,2 m) ;
  - le DXF est vérifié par une analyse de texte, sans bibliothèque DXF ;
  - la comparaison côte à côte des images Sentinel-2 (« Comparer », onglet Site), les fonds satellite (sans clé) et le polygone dans la boîte « Nouveau site » (seul le rectangle est testé) ne sont pas couverts ;
  - le rendu visuel des planches n'est pas jugé ici : c'est le rôle du contrôle cartographique.
- Les avertissements `GL Driver Message … GPU stall due to ReadPixels` viennent du WebGL de Chromium sans interface (capture des vignettes et des exports), pas de l'application.

## Défauts par gravité
1. **Important** : D1, Maj + clic inopérant (MapLibre `boxZoom`), donc fusion inaccessible depuis l'interface (`lib/mapbase.ts`, `lib/tools.ts`).
2. **Important** : D2, choisir un projet dans la liste de l'onglet Projet bascule sur l'onglet Couche (`components/ProjectPanel.tsx`, `lib/store.ts`).
3. Mineur : D3, profil hors ligne en HTTP 500 « Erreur interne : fetch failed », et message des isochrones qui oriente vers ORS_API_KEY.
4. Mineur : D4, nom de la couche tampon périmé après « Appliquer » jusqu'au rechargement.
5. Mineur : D5, point décimal au lieu de la virgule (profil, ombres, notes de collecte).
6. Mineur : D6, avertissements MapLibre « found null » à chaque chargement du fond.
7. Mineur : D7, ordre « (10, 5 min) » et fichiers GeoJSON en trop.

Aucun défaut bloquant : tout le scénario se déroule de bout en bout, sans erreur dans la console du navigateur ni dans le terminal du serveur quand le réseau est disponible.
