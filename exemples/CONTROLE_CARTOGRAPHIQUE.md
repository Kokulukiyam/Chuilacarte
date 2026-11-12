# Contrôle cartographique des exports de mise en page

## 7e passage — 12/11/2026

Serveur `localhost:3500` reconstruit, partagé avec le test de bout en bout ; je n'ai pas touché aux sites `e2e-*`. Sur les 3 sites `exemple-*`, j'ai supprimé les mises en page et recréé les 6 planches avec les réglages par défaut. Les 18 exports ont été faits un à la fois et remplacent les fichiers de `exemples/`. Aucune erreur dans la console.

| Défaut | Statut | Preuve |
|---|---|---|
| N10 — nom en double | **Corrigé** | Aucun nom répété sur les 6 planches (comptage des étiquettes dans les SVG). « Stade Mame Massene Sene » n'apparaît plus qu'une fois (Fatick A2 et A4), comme « Mosquée Seydou Nourou Tall » (Médina 1/2 500). |
| N11 — noms petits, aéroport mal placé | **Partiellement corrigé** | Taille minimale de 5,5 pt en A4 (1,94 mm), 6 pt en A3, 8,4 pt en A2 et 12 pt en A1. Le nom de l'aéroport de Yoff part maintenant de l'intérieur de l'aéroport, mais sa fin (« …Léopold-Sédar-Senghor ») déborde sur la bande d'habitat à l'est, et il reste écrit en 6 pt sur une ligne de 110 mm (Yoff A3, zone 2450-3350 × 1290-1360 px). |
| N12 — nom sur un point voisin | **Corrigé pour les équipements** | Yoff A1 : « Pharmacie MAME Ndiaré » est passé au-dessus de son point et ne touche plus le point Transport. Mais le nom d'une surface peut encore couvrir un point : sur Fatick A4, « Stade Mame Massene Sene », posé au centre du stade, recouvre le point vert « Sport et loisirs » (zone 600-1800 × 850-1600 px). |
| C10 — numéro de planche | **Corrigé, avec une réserve** | Le numéro est toujours affiché. Mais il est calculé au moment de l'export. La 1re planche de chaque site, exportée avant la création de la 2e, porte « 1 / 1 », alors que le site compte finalement 2 planches (« 2 / 2 » sur la 2e). Il faut réexporter la 1re planche pour obtenir « 1 / 2 ». |
| Noms de planche | **Corrigé** | « Planche A3 » et « Planche A3 (2) » (Médina), « Planche A3 » et « Planche A1 » (Yoff), « Planche A2 » et « Planche A4 » (Fatick). |
| C13 — « MALI » sur la frontière | **Corrigé** | Dans l'encart étroit du portrait Médina, « MALI » tient entièrement dans le Mali (zone 1530-2330 × 3700-4700 px). |

**Pas de régression**
- Légende de Fatick A4 complète : 2 colonnes, avec tous les groupes, du bâti à « Autres ».
- Sources complètes jusqu'à « …et l'ESA » dans les 6 cartouches, sans « … » rouge.
- Échelle exacte : Fatick A4 1/10 000,1 et 1/9 999,9 ; Médina 1/2 500,0 ; Yoff A3 1/4 999,9 et 1/5 000,1. Barres de 50,2 mm (A4) et 80,2 mm (A1) avec contour.
- PNG A1 : 38 s, RSS max 1,8 Go.

Restent ouverts : C4 (courbes au 1/1 000 issues d'un relief à 30 m), R3 (trait de la voie visible entre les mots des noms de rues), C7 (`Identity-H` dans les PDF), maître d'ouvrage, auteur et phase vides par défaut dans le cartouche, aucune rue nommée dans OSM à Fatick (limite des données).

---


## 6e passage — 12/11/2026

Serveur `localhost:3500` reconstruit, laissé en marche. Sur les 3 sites `exemple-*`, j'ai supprimé les mises en page et recréé les 6 planches avec les réglages par défaut. Les 18 exports ont été faits un à la fois et remplacent les fichiers de `exemples/`.
- Aucune erreur dans la console. PNG A1 : 36 s, RSS max 1,8 Go.
- Pas de régression d'échelle : Médina 1/1 000,0, Yoff A1 1/2 500,0, Fatick A4 1/10 000,1 en est-ouest comme en nord-sud ; barres de 50,2 mm avec contour.
- Légende de Fatick A4 complète, sur 2 colonnes. Sources complètes jusqu'à « …et l'ESA » dans les 6 cartouches, sans « … » rouge.

| Défaut | Statut | Preuve |
|---|---|---|
| C3 — toponymie | **Largement corrigé** | Les équipements sont nommés : 6 noms à Médina 1/1 000, 27 à Médina 1/2 500, 20 à Fatick A4 (« Mosquée de Fatick », « Mairie de Fatik », « Préfecture de Fatick »…). L'aéroport de Yoff est nommé. Les noms ont un halo et ne sortent pas du cadre. Fatick reste sans nom de rue (0 nom dans OSM, limite des données). Voir N10 et N11. |
| C13 — carte de situation | **Corrigé** | Pays voisins en gris, océan bleu pâle, noms (MAURITANIE, MALI, GUINÉE-BISSAU / GUINÉE, SÉNÉGAL en gras). Le point de Dakar est sur la côte (Médina A3, zone 3640-4880 × 2180-2800 px). Petit reste : « MALI » chevauche la frontière dans l'encart étroit du portrait Médina. |
| C12 — hiérarchie de la légende | **Corrigé** | Entrées en retrait sous leur titre, et groupes entiers dans une colonne (« Occupation du sol » en tête de la 2e colonne sur Médina A3 portrait). Les couches sans titre (bâti, courbes, plans d'eau, espaces verts) sont séparées et sans retrait, donc distinctes de la voirie. La légende se limite à ce qui est visible : Médina 1/1 000 n'affiche plus Santé, Sport, Voie tertiaire, Chemin piéton ni Autres. |
| C10 — cartouche | **Partiellement corrigé** | « PLANCHE 2 / 2 » apparaît sur les 2es planches. La 1re planche de chaque site n'a pas de numéro : elle a été exportée quand elle était seule, et le numéro est calculé au moment de l'export, donc il n'existe pas encore. Les champs maître d'ouvrage, auteur et phase restent vides par défaut, et le cartouche reste à moitié vide en portrait. |
| N5 — habillage proportionné | **Corrigé** | Yoff A1 : les noms du fond sont agrandis (« Rue Ma Libasse Ndir », « Avenue Seydina Limamoulaye », environ 5 mm de haut, zone 5600-7300 × 200-1600 px). Les noms d'équipements sont aussi agrandis (4,2 à 4,8 mm). |
| N9 — police du SVG | **Corrigé** | Chaque SVG contient deux `@font-face` Inter (400 et 700) en base64. |
| Points superposés | **Corrigé** | Médina 1/2 500 : les deux points « Sport et loisirs » (« L'empire », « Empire des enfants ») sont maintenant distincts. Aucune tache fusionnée vue sur les 6 planches. |
| Noms de planche | **Partiellement corrigé** | « Planche A3 » et « Planche A3 (2) » à Médina. Mais la 2e planche de Yoff s'appelle « Planche A1 (2) » alors que c'est la seule A1 ; même chose pour Fatick (« Planche A4 »). Mineur. |

**Nouveaux défauts**
- **N10 — Nom affiché en double.** Gravité : mineur à important.
  - Fatick A2 et A4 : « Stade Mame Massene Sene » est imprimé deux fois, l'un au-dessus de l'autre. Une étiquette vient du point d'équipement, l'autre de l'emprise du stade. La première recouvre le point vert du stade (Fatick A4, zone 600-1800 × 850-1600 px).
  - Médina 1/2 500 : « Mosquée Seydou Nourou Tall » apparaît deux fois à 37 m d'écart (deux objets OSM).
  - Piste : dédoublonner les étiquettes de même texte à faible distance, et ne pas étiqueter une emprise dont le nom est déjà porté par un équipement à l'intérieur.
- **N11 — Noms d'équipements petits sur A4 et A3.** Gravité : mineur.
  - Taille : 1,69 mm (4,8 pt) en A4, 2,12 mm (6 pt) en A3, sous le plancher de 6 pt retenu pour la légende en A4.
  - Le nom de l'aéroport de Yoff (« Aéroport militaire - ancien aeroport international Léopold-Sédar-Senghor ») est imprimé en 6 pt sur une ligne et commence dans la zone d'habitat, à gauche de l'aéroport (Yoff A3) : peu lisible pour l'objet principal de la planche.
- **N12 — Nom qui touche un point voisin.** Gravité : mineur. Yoff A1 : « Pharmacie MAME Ndiaré » touche le point « Transport » placé juste dessous.

Restent ouverts depuis les passages précédents : C4 (courbes au 1/1 000 issues d'un relief à 30 m), R3 (trait de la voie visible entre les mots des noms de rues), C7 (`Identity-H` dans les PDF).

---


## 5e passage — 05/11/2026

Serveur `localhost:3500` reconstruit, laissé en marche. Sur les 3 sites `exemple-*`, j'ai supprimé les mises en page et recréé les 6 planches avec les réglages par défaut. Les 18 exports ont été faits un à la fois avec les boutons et remplacent les fichiers de `exemples/`. Aucune erreur dans la console. Échelle toujours exacte : Fatick A4 à 1/10 000,1 dans les deux sens, barre de 50,2 mm avec contour.

| Défaut | Statut | Preuve |
|---|---|---|
| R5 — sources coupées dans le cartouche | **Corrigé** | Les 6 cartouches se terminent par « …par l'Union européenne et l'ESA », sans « … » rouge. Taille des sources : 5,5 pt en A3 et A4, 7 pt en A2, 10,1 pt en A1 ; le plancher de 4 pt n'a jamais servi. Fatick A4 : 6 lignes, dernière ligne 9 mm au-dessus du bas du cadre (zone 2570-3500 × 2100-2480 px du PNG ; même chose dans le PDF rendu par Quick Look). |
| R6 — unité séparée de sa valeur | **Corrigé** | « Zone tampon de 500 m » et « Courbes de niveau (2 m) » sont entiers sur une ligne, avec une espace insécable dans le SVG. Aucune ligne de légende réduite à « m » ou « m) » sur les 6 planches. |
| R1 — légende de Fatick A4 complète | **Toujours conforme** | Les 22 entrées sont présentes, sur 2 colonnes en 6 pt, avec environ 8 mm de marge en bas du cadre. |

Pas de nouveau défaut sur les points contrôlés. Restent inchangés depuis le 4e passage : C3, C13, C12 (couches sans titre à la suite de « Voirie »), C10/N8, C4, R3, N9, C7, ainsi que les noms du fond à leur taille A3 en A1.

---


## 4e passage — 05/11/2026

Serveur `localhost:3500` reconstruit avec les corrections ; laissé en marche.

**Méthode**
- Sur les 3 sites `exemple-*`, j'ai supprimé les mises en page, puis recréé les 6 planches par l'interface avec les réglages par défaut.
- Les 18 exports (PNG, PDF, SVG) ont été faits un à la fois avec les boutons et remplacent les fichiers de `exemples/`.
- Aucune erreur dans la console du navigateur. PNG A1 : 35 s, RSS max 1,8 Go.
- Les barres d'échelle et l'échelle réelle restent exactes (Fatick A4 : 1/10 000,1 dans les deux sens ; Yoff A1 : 1/2 500,0).

| Défaut | Statut | Preuve |
|---|---|---|
| R1 — légende tronquée (Fatick A4) | **Corrigé** | Les 22 entrées sont présentes, sur 2 colonnes, en 2,29 mm (6,5 pt) : `fatick_A4_paysage_1-10000.png`, zone 2570-3500 × 600-1520 px. Même chose dans le SVG, dont la légende contient 29 textes. |
| R2 — groupes coupés entre colonnes | **Corrigé** | Aucun titre orphelin. Chaque groupe tient dans une seule colonne : « Occupation du sol (OSM) » en tête de la 2e colonne, avec ses entrées (Fatick A2, Médina A3 portrait). Les légendes en paysage A3 et A1 tiennent sur une colonne. Le cas « (suite) » ne s'est présenté sur aucune planche. |
| R4 — « ; » en début de ligne | **Corrigé** | Aucune ligne des sources ne commence par « ; », « : » ou « , » dans les 6 cartouches. |
| C12 — hiérarchie de la légende | **Partiellement corrigé** | Un espace sépare les groupes, et la lecture est bien meilleure. Mais « Bâtiments détectés », « Courbes de niveau », « Plans d'eau » et « Espaces verts » restent des entrées sans titre de groupe, à la suite de « Voirie (OSM) ». |
| N8 — mise en page déséquilibrée | **Partiellement corrigé** | La légende des portraits passe sur 2 colonnes bien remplies (Fatick A2, Médina A3 portrait). Le cartouche reste vide aux deux tiers en portrait et en A1 : Fatick A2 et Yoff A1, où il est vide sous les sources. |

**Nouveaux défauts**
- **R5 — Sources coupées dans le cartouche de Fatick A4.** Gravité : important (attribution de licence incomplète).
  - Symptôme : le cartouche, réduit à 15 % de la hauteur, ne contient plus toutes les sources. Le texte s'arrête sur « …fourni dans le cadre de COPERNICUS par l'Union », suivi d'un « … » **rouge** imprimé. La fin de l'attribution Copernicus, « européenne et l'ESA », manque.
  - Preuves : `fatick_A4_paysage_1-10000.png`, zone 2570-3500 × 2020-2480 px ; même chose dans le SVG et le PDF.
  - Les 5 autres planches ont leurs sources complètes.
  - Cause probable : la hauteur fixe du cartouche en paysage ne tient pas compte de la longueur des sources en A4. Il faudrait réduire les sources jusqu'à un plancher, ou agrandir le cartouche, plutôt que de tronquer.
- **R6 — Unité séparée de sa valeur.** Gravité : mineur.
  - Symptôme : dans les légendes en colonnes étroites, « Zone tampon de 500 » passe à la ligne avant « m », et « Courbes de niveau (2 » avant « m) » (Fatick A4).
  - Piste : une espace insécable entre le nombre et l'unité.
- **R3** (trait visible entre les mots des noms de rues) est toujours présent : « Avenue·Blaise·Diagne », « Rue·de·Reims » sur Médina 1/1 000.

Restent inchangés depuis le 3e passage : C3 (toponymie), C4 (courbes au 1/1 000), C10 (cartouche pauvre), C13 (encart de situation), N9 (police du SVG), C7 (`Identity-H`), noms du fond à leur taille A3 en A1.

---


## 3e passage — 05/11/2026

Version contrôlée : build corrigé déjà servi sur `localhost:3500` (pas de nouveau build, serveur laissé en marche).

**Méthode**
- Sur les 3 sites `exemple-*`, j'ai supprimé les mises en page existantes, puis recréé les 6 mêmes planches par l'interface avec les réglages par défaut. Comme au 2e passage, seuls le format, l'orientation et l'échelle ont été changés.
- Les 18 exports (PNG 300 dpi, PDF, SVG) ont été faits un à la fois avec les boutons, et remplacent les fichiers de `exemples/medina|yoff|fatick/`.
- Aucune erreur dans la console du navigateur.
- Même méthode de contrôle :
  - vue d'ensemble, puis recadrages à pleine résolution ;
  - PDF rastérisés par Quick Look, SVG inspectés ;
  - barre d'échelle mesurée en pixels ;
  - échelle réelle mesurée sur les points d'équipements, comparée aux distances géodésiques.

**Mesures**
- **Barres d'échelle :** toutes exactes. Médina 1/1 000 : 593 px = 50,2 mm avec contour, pour 50 mm attendus. Yoff A1 : 947 px = 80,2 mm, pour 80 mm. Les quatre autres : 475 ou 593 px, conformes.
- **Échelle réelle :** médianes est-ouest et nord-sud de 1/1 000,0, 1/2 500,0, 1/4 999,9–1/5 000,1, 1/2 500,0, 1/5 000,0 et 1/10 000,1 sur les 6 planches. Aucune régression.
- **Mémoire et durée des PNG :**
  - RSS max du serveur entre 0,86 et 1,53 Go ;
  - de 9 à 25 s par planche, mais **58 s pour l'A1** (16 s au 2e passage), le serveur 3500 étant partagé avec l'autre agent.
- **PDF :** formats de page conformes, `/Ordering (Identity-H)` toujours présent 3 fois par fichier.
- **SVG :** couches du site vectorielles (447 à 8 503 `<path>`). Les étiquettes et la mer du fond sont en images : 2 à 18 `<image>`, deux fois plus qu'au 2e passage. Toujours aucun `@font-face`.

### Statut des défauts

| Défaut | Statut | Preuve |
|---|---|---|
| N1 — sous-titre figé | **Corrigé** | Médina 1/1 000 « Plan masse » ; Médina 1/2 500 et Yoff A1 « Plan de l'îlot et de ses abords » ; 1/5 000 et 1/10 000 « Plan de quartier ». |
| N2 — gris sans légende | **Corrigé** | Entrée « Autres » sous l'occupation du sol sur les 6 planches. Elle est rejetée dans la 2e colonne (voir R2). |
| N3 — légende à 3,9 pt en A4 | **Corrigé pour la taille, mais régression bloquante** | Texte de légende à 2,12 mm (6 pt) et sources du cartouche plus grandes. Mais la légende de Fatick A4 est désormais **tronquée** (voir R1). |
| N4 — noms de rues du fond | **Largement corrigé** | Texte foncé avec halo couleur papier, lisible sur le bâti : Yoff « Rue Ma Libasse Ndir » et « Avenue Seydina Limamoulaye », Médina « Rue de Reims ». Les noms tombent désormais sur l'axe des voies du site (Médina 1/1 000, 1950-2750 × 1650-2350 px). Reste un artefact, voir R3. |
| N5 — habillage non proportionné | **Largement corrigé** | Yoff A1 : points de légende de la taille de ceux de la carte, barre d'échelle d'environ 2,8 mm d'épaisseur, « Situation » et point de l'encart agrandis. Le symbole « Emprise du site » n'est plus cassé en A4. Restent en taille A3 : les noms du fond en A1 (environ 2,5 mm de haut, lisibles mais faibles à distance), et la barre de 40 mm en A2 portrait. Mineur. |
| N6 — mer absente | **Corrigé** | Yoff : l'océan est bleu très pâle en haut à gauche, sur les deux planches. Pas d'entrée de légende pour la mer, ce qui est acceptable pour un élément de fond. |
| N7 — courbes au-dessus du bâti | **Corrigé** | Médina 1/1 000 (2500-3000 × 1900-2300 px) : la courbe passe sous les toits. |
| N8 — mise en page déséquilibrée | **Toujours présent** | Cartouche vide aux deux tiers ou aux trois quarts sur les 6 planches ; barre de 40 mm en A2 portrait. La légende des portraits passe maintenant sur 2 colonnes, mais la 2e ne contient que 2 ou 3 entrées. |
| N9 — police non incluse dans le SVG | **Toujours présent** | 0 `@font-face` dans les 6 SVG. |
| C3 — toponymie | **Toujours présent** | Fatick : seul « Fatick » est nommé, aucune rue sur 2 km. Aéroport de Yoff sans nom. Aucun équipement ni quartier nommé, sauf « REBEUSS » à Médina. |
| C4 — courbes | **Partiellement corrigé** | Courbes cotées, lissées, maintenant sous le bâti. Mais au 1/1 000, elles viennent toujours d'un modèle de surface à 30 m (boucles autour des îlots, sans valeur pour un plan masse). |
| C10 — cartouche pauvre | **Toujours présent** | 4 lignes (projet, date, échelle, projection). Maître d'ouvrage, auteur, phase et planche sont vides et masqués. |
| C12 — hiérarchie de la légende | **Partiellement corrigé** | « Courbes de niveau » n'est plus sous « Équipements », mais il est toujours rangé sans titre sous « Voirie (OSM) », entre le bâti et les cours d'eau, avec « Bâtiments » et « Espaces verts ». Les groupes sont coupés entre colonnes (R2). |
| C13 — carte de situation | **Toujours présent** | Sénégal seul : sans océan, sans voisins, sans nom, sans cadre d'emprise. À Dakar, le point rouge est hors du trait de côte (Médina, Yoff). Seule la taille du point et du titre suit désormais le format. |

### Nouveaux défauts (régressions du 3e passage)

**R1 — Légende tronquée sans avertissement sur Fatick A4 1/10 000.** Gravité : **bloquant**.
- Symptôme : la légende s'arrête après « Voie de desserte ». Elle omet toutes les autres classes visibles sur la carte :
  - Chemin piéton ;
  - Bâtiments détectés ;
  - Courbes de niveau ;
  - Plans d'eau, pourtant bien visibles en bleu ;
  - Espaces verts ;
  - tout le groupe « Occupation du sol » (Habitat, Emprise militaire, Cimetière, Autres).
- Il n'y a ni « … » ni avertissement imprimé, et le cadre de la légende (70 × 59 mm) garde environ 8 mm de blanc en bas.
- Preuves :
  - `fatick/fatick_A4_paysage_1-10000.png`, zone 2570-3470 × 600-1420 px ;
  - même chose dans le PDF (rendu Quick Look) ;
  - le `<g id="legende">` du SVG ne contient que 15 textes.
- Cause probable : le plancher de 6 pt (N3) s'applique, mais le cadre par défaut d'une planche A4 paysage est trop petit. Une fois toutes les variantes épuisées, `renderLegend` rend la dernière tentative, tronquée, sans le signaler sur la planche. Il faudrait agrandir le cadre de légende par défaut en A4 (l'encart ou le cartouche peuvent céder de la place), ou indiquer clairement la troncature. Au 1er passage, ce cas était imprimé en rouge ; maintenant, il est silencieux.

**R2 — Groupes de légende coupés entre colonnes.** Gravité : important.
- Symptôme : depuis que 2 ou 3 colonnes sont essayées avant de réduire, la 2e colonne ne contient que la fin du groupe « Occupation du sol », sans son titre :
  - Médina A3 paysage et portrait : « Commerce » et « Autres » ;
  - Yoff A3 : « Aéroport » et « Autres » ;
  - Fatick A2 : « Cimetière » et « Autres ».
- Sur Yoff A1, le titre « Occupation du sol (OSM) » est seul en bas de la 1re colonne, et ses trois entrées en haut de la 2e : titre orphelin.
- Preuves : recadrages de légende `medina_A3_paysage_1-1000.png` (3640-4880 × 740-1840 px) et `yoff_A1_paysage_1-2500.png` (7300-9900 × 1400-3600 px).
- Cause probable : le passage à la colonne suivante se fait ligne par ligne. Il faudrait garder un titre avec au moins sa première entrée, et de préférence un groupe entier dans une même colonne, ou équilibrer la hauteur des colonnes.

**R3 — Trait visible entre les mots des noms de rues.** Gravité : mineur.
- Symptôme : maintenant que les noms sont posés sur l'axe des voies, la voie du site se voit à travers les espaces entre les mots. Le halo s'arrête à chaque glyphe. On lit « Rue·de·Reims », « Avenue·Blaise·Diagne », « Rue·Ma·Libasse·Ndir ».
- Preuves : Médina 1/1 000, 1950-2750 × 1650-2350 px ; Médina 1/2 500 et Yoff, partout.
- Piste : élargir le halo (`text-halo-width`) pour qu'il couvre les espaces, ou masquer la voie sous le nom.

**R4 — Ponctuation des sources en début de ligne.** Gravité : mineur.
- Symptôme : dans le cartouche, des lignes commencent par « ; Google Open Buildings… » (Médina A3 portrait) ou par « : Copernicus » (2e passage).
- Piste : une espace insécable avant « ; » et « : ».

### Évaluation d'ensemble

Les corrections N1, N2, N4, N5, N6 et N7 se voient sur les planches. Les noms de rues sont enfin lisibles et posés sur les voies, la mer apparaît et le sous-titre suit l'échelle.

Le passage aux légendes multi-colonnes introduit deux régressions :
- une légende A4 tronquée sans avertissement (bloquant) ;
- des groupes coupés entre colonnes (important).

Il reste aussi à traiter la toponymie (C3), la carte de situation (C13) et le cartouche (C10) pour un rendu de niveau professionnel.

---


## 2e passage — 04/11/2026

Version contrôlée : build de production `scripts/test-server.sh 3600` (dossier `.next-test-3600`, BUILD_ID `4v_RTN0znH0fFY_NQX3oR`), branche `claude/chuilacarte` au commit `019a5e1`. Le serveur a été arrêté à la fin du contrôle.

**Méthode**
- Trois sites neufs ont été créés par `POST /api/sites`, puis renommés par `PATCH` :
  - `exemple-medina` « Médina îlot », tampon de 300 m ;
  - `exemple-yoff` « Yoff », tampon de 300 m ;
  - `exemple-fatick` « Fatick centre », tampon de 500 m.
- La collecte a été lancée par l'interface (bouton « Collecter les données », sources par défaut) et pilotée par Playwright. Toutes les sources ont réussi sur les 3 sites (OSM, Overture, Google Open Buildings, Copernicus DEM, WorldCover, JRC, Sentinel-2, WorldPop, geoBoundaries).
- Pour les mises en page, j'ai gardé les réglages par défaut :
  - la première planche est créée automatiquement ; la seconde est créée avec « + Nouvelle mise en page » ;
  - seuls le format, l'orientation et l'échelle ont été changés avec les menus.
- Les exports ont été lancés un par un avec les boutons PNG, PDF et SVG. Aucune erreur dans la console du navigateur.
- J'ai regardé chaque image : vue d'ensemble réduite, puis recadrages à pleine résolution du titre, de la légende, de la barre d'échelle, de la flèche du nord, du cartouche, des sources, de l'encart et des zones denses.
- Les PDF ont été rastérisés avec Quick Look (`qlmanage -t -s 4000`), car poppler n'est pas installé. Les SVG ont été rendus dans Chromium.
- Mesures :
  - **barre d'échelle** : plus longue suite de pixels sombres dans le PNG à 300 dpi ;
  - **échelle réelle** : centres des points d'équipements OSM retrouvés par leur couleur exacte (composantes connexes), puis distances sur la page comparées aux distances géodésiques WGS 84 (Vincenty), sur toutes les paires de points et séparément en est-ouest et en nord-sud ;
  - **mémoire du serveur** : RSS de `next-server`, lu chaque seconde par `ps -o rss` pendant chaque export.

### Fichiers produits

| Site | Mise en page | PNG 300 dpi | PDF | SVG | PNG : durée / RSS max du serveur |
|---|---|---|---|---|---|
| Médina îlot | A3 paysage 1/1 000 | `medina/medina_A3_paysage_1-1000.png` (4 961 × 3 508) | `…pdf` (420 × 297 mm) | `…svg` | 6 s / 1,26 Go |
| | A3 portrait 1/2 500 | `medina/medina_A3_portrait_1-2500.png` (3 508 × 4 961) | `…pdf` | `…svg` | 5 s / 0,93 Go |
| Yoff | A3 paysage 1/5 000 | `yoff/yoff_A3_paysage_1-5000.png` (4 961 × 3 508) | `…pdf` | `…svg` | 5 s / 0,63 Go |
| | A1 paysage 1/2 500 | `yoff/yoff_A1_paysage_1-2500.png` (9 933 × 7 016) | `…pdf` (841 × 594 mm) | `…svg` | 16 s / **1,73 Go** |
| Fatick centre | A2 portrait 1/5 000 | `fatick/fatick_A2_portrait_1-5000.png` (4 961 × 7 016) | `…pdf` (420 × 594 mm) | `…svg` | 12 s / 1,38 Go |
| | A4 paysage 1/10 000 | `fatick/fatick_A4_paysage_1-10000.png` (3 508 × 2 480) | `…pdf` (297 × 210 mm) | `…svg` | 5 s / 0,84 Go |

Les fichiers du 1er passage ont été supprimés. Tous les PNG sont en RVB, sur 3 canaux, avec une densité de 300 dpi. Les PDF ont le bon format de page (MediaBox vérifiée).

Le RSS de 1,26 Go mesuré sur Médina comprend la mémoire restée occupée après la collecte (DuckDB). Les exports PDF et SVG restent sous 1,4 Go.

Les jonctions entre les bandes de rendu PNG (tous les 1 600 px) ne montrent aucune discontinuité : l'écart moyen entre deux lignes voisines est le même à la jonction qu'à côté.

Réglages obtenus par défaut :
- fond « Papier + noms de rues » ;
- couches visibles : emprise, tampon, équipements, courbes, voirie, bâti Google, eau, espaces verts, occupation du sol OSM ;
- bâti OSM masqué.

### Mesures

| Planche | Barre d'échelle (mesurée / attendue) | Échelle réelle est-ouest / nord-sud (médianes) | Plus longue paire de points |
|---|---|---|---|
| Médina A3 1/1 000 | 593 px = 50,2 mm avec contour (50 mm) | 1/1 000,0 / 1/1 000,0 (14 et 11 paires) | 274,19 mm pour 274,19 m |
| Médina A3 1/2 500 | — (40 mm, même gabarit) | 1/2 500,0 / 1/2 500,0 (276 et 248 paires) | 314,65 mm pour 786,64 m |
| Yoff A3 1/5 000 | 475 px = 40,2 mm (40 mm) | 1/4 999,9 / 1/5 000,1 | 356,73 mm pour 1 783,65 m |
| Yoff A1 1/2 500 | 947 px = 80,2 mm (80 mm) | 1/2 500,0 / 1/2 499,9 | 654,33 mm pour 1 635,81 m |
| Fatick A2 1/5 000 | 475 px = 40,2 mm (40 mm) | 1/4 999,9 / 1/5 000,0 | 446,02 mm pour 2 230,05 m |
| Fatick A4 1/10 000 | 593 px = 50,2 mm (50 mm) | 1/10 000,1 / 1/10 000,1 | 245,99 mm pour 2 459,88 m |

Les 0,2 mm d'écart sur les barres viennent du contour de 0,2 mm. Les échelles sont exactes à mieux que 0,01 % dans les deux directions.

### Statut des défauts du 1er passage

| Défaut | Statut | Preuve |
|---|---|---|
| Bloquant 1 — mémoire de l'export PNG (10,4 Go en A1, serveur tué) | **Corrigé** | A1 1/2 500 rendu en 16 s avec un RSS max de 1,73 Go. Exports lancés un par un sans incident. Pas de jonction visible entre les bandes. |
| Bloquant 2 — « légende incomplète » imprimé en rouge | **Corrigé** | Aucun texte rouge dans les 18 fichiers (la chaîne n'apparaît pas dans les SVG). La légende se réduit pour tenir. Effet secondaire : texte à 3,9 pt en A4 (voir N3). |
| Bloquant 3 — libellés et valeurs du cartouche superposés (A1, A2) | **Corrigé** | Yoff A1 : la colonne « PROJECTION » est séparée de sa valeur ; même chose en Fatick A2 (recadrages du cartouche). |
| C1 — fond et couches doublés (bâti Google + OSM, chaussées, eau, verts) | **Corrigé** | Une seule source de bâti (Google) ; le fond papier n'a ni bâti, ni chaussée, ni eau. Les chevauchements qui restent viennent des empreintes Google elles-mêmes (Médina 1/1 000, îlot central). |
| C2 — noms de rues barrés par les voies | **Corrigé** (les étiquettes passent au-dessus), mais voir N4 : les noms ne sont pas posés sur les voies et n'ont pas de halo | Médina 1/2 500, « Avenue Blaise Diagne » au-dessus de la voie ; Yoff, « Rue Ma Libasse Ndir ». |
| C3 — toponymie faible | **Toujours présent** | Fatick A2 et A4 : un seul nom (« Fatick ») et aucun nom de rue sur 2 km. Yoff : aéroport sans nom, 3 noms de rues. Aucun équipement nommé : les couches `poi` du fond sont filtrées (`lib/mapbase.ts:60`) et les équipements n'ont pas d'étiquette par défaut. |
| C4 — courbes de niveau | **Partiellement corrigé** | Les courbes sont lissées et cotées (« 6 m », « 10 m », « 20 m », avec halo). Mais au 1/1 000 (Médina), elles viennent toujours d'un modèle de surface à 30 m qui inclut le bâti : boucles fermées autour des îlots, sans valeur pour un plan masse. Elles sont aussi dessinées **au-dessus** du bâti (recadrage Médina 1/1 000, 1700-2900 × 1400-2300 px). |
| C5 — anisotropie nord-sud de 0,63 % | **Corrigé** | Est-ouest et nord-sud à 1/1 000,0 près (tableau ci-dessus). Les points sont décalés de 9 à 15 px par rapport à une projection sphérique pure, ce qui confirme la correction ellipsoïdale. |
| C6 — carte raster dans le PDF et le SVG | **Largement corrigé** | Les couches du site sont vectorielles : 447 à 8 503 `<path>` par SVG. Seules les étiquettes du fond restent raster (1 à 9 images de 2 047 px, soit 200 ppi, dans le PDF et le SVG). Le SVG n'inclut pas sa police (voir N9). |
| C7 — police CID du PDF | **Partiellement corrigé** | Les polices sont maintenant en sous-ensemble (flux FontFile2 de 84 à 90 Ko contre 342 Ko pour le TTF complet). `/Ordering (Identity-H)` reste présent 3 fois dans chaque PDF. |
| C8 — attribution répétée et coupée | **Corrigé** | Une seule occurrence, dans le cartouche. « © les contributeurs d'OpenStreetMap » n'apparaît qu'une fois. Rien n'est coupé, dans le PNG comme dans le PDF. |
| C9 — texte du cartouche hors cadre | **Corrigé** | Les sources passent à la ligne à l'intérieur du cadre sur les 6 planches, y compris en A1 (mesure avec la vraie police). |
| C10 — cartouche pauvre | **Partiellement corrigé** | Les champs maître d'ouvrage, auteur, phase et planche existent, mais ils sont vides et masqués par défaut. Il reste 4 lignes, et 50 à 75 % du cadre est vide sur les 6 planches. Le sous-titre suivant l'échelle ne fonctionne qu'à la création (voir N1). |
| C11 — légende avec des entrées hors champ | **Corrigé** | Le tampon n'est en légende que s'il est visible : il est absent à Médina 1/2 500, et présent en Fatick A4 où il passe dans les coins. |
| C12 — légende mal hiérarchisée, occupation du sol grise | **Partiellement corrigé** | L'occupation du sol est catégorisée (Habitat, Commerce, Aéroport, Emprise militaire, Cimetière). Mais « Courbes de niveau » est toujours rangé sans titre sous « Équipements (OSM) » sur les 6 planches. Les catégories hors liste sont dessinées en gris sans entrée de légende (voir N2). |
| C13 — carte de situation sommaire | **Toujours présent** | Sénégal seul : sans océan, sans pays voisins, sans nom, sans cadre d'emprise. Le point de Dakar touche le bord gauche du pays (Médina, Yoff). Le texte « Situation » (2,2 mm) et le point (rayon 1,4 mm) ne suivent pas le format : ils sont minuscules en A1. |
| C14 — noms de fichiers, PNG en RGBA | **Corrigé** | Les noms suivent le format (`planche-a3-A3`, `planche-a2-A2`), et les PNG sont en RVB. Seul reste : la 2e planche s'appelle « Planche 2 », d'où des fichiers `…-planche-2-A4-…`. |
| Priorité 2 n° 10 — tailles qui ne suivent pas le format | **Partiellement corrigé** | Sur la carte, traits et points suivent le facteur ×2 en A1 (points de 3,7 mm). Mais les symboles de légende, l'épaisseur de la barre d'échelle (1,6 mm), le texte et le point de l'encart, et les étiquettes du fond restent à la taille A3 (voir N5). |
| Priorité 3 n° 18 — points d'équipement superposés | **Toujours présent** | Médina 1/2 500 : deux points « Sport et loisirs » collés. Fatick A2 : deux « Commerce » collés au nord-ouest de l'emprise. |

### Nouveaux défauts

**N1 — Le sous-titre ne suit pas l'échelle choisie.** Gravité : important.
- Symptôme : les 6 planches portent « Plan de quartier ». On attendrait « Plan masse » au 1/1 000 (Médina A3 paysage) et « Plan de l'îlot et de ses abords » au 1/2 500 (Médina A3 portrait, Yoff A1).
- Preuve : vue d'ensemble de chaque planche, sous le titre.
- Cause probable : `subtitleFor(l.scale)` n'est appelé que dans `newLayout` (`lib/layout/defaults.ts`), avec l'échelle d'ajustement automatique (1/5 000 ici). Changer l'échelle dans le menu ne met pas le sous-titre à jour.

**N2 — Surfaces grises sans entrée de légende.** Gravité : important.
- Symptôme : les valeurs d'occupation du sol absentes de la liste de classes sont peintes dans la couleur « autre » (#e7e5e4), sans entrée de légende. Sur le papier, on voit des surfaces grises inexpliquées :
  - Médina : `stadium`, `brownfield`, `track`, `restaurant`, `traffic_island` ; disque gris au centre du rond-point (recadrage 1700-3000 × 1100-2000 px du 1/2 500) ;
  - Yoff : `brownfield`, `swimming_pool` ;
  - Fatick : stade (aplat beige-gris autour du terrain, A2 et A4).
- Cause probable : `buildLegend` (`lib/layout/legend.ts`) ne garde que les classes définies et présentes. La valeur `other` n'a jamais d'entrée « Autres ».

**N3 — Légende réduite à 3,9 pt en A4.** Gravité : important.
- Symptôme : sur Fatick A4 1/10 000, la légende est écrite en `font-size="1.36"` mm, soit 3,9 pt, illisible à l'impression. Le cadre garde pourtant environ 15 % de blanc en bas.
- Preuves :
  - recadrage 2570-3470 × 580-1420 px ;
  - le PDF est identique ;
  - les sources du cartouche sont aussi à 3,9 pt.
- Cause probable : la taille de base est déjà réduite (5,5 pt, avec un facteur de format de 0,75), puis `renderLegend` descend jusqu'à 70 % sur une colonne avant d'essayer deux colonnes. Il faudrait un plancher d'environ 6 pt, et essayer deux colonnes plus tôt.

**N4 — Noms de rues du fond mal posés et sans halo.** Gravité : important.
- Symptôme : les noms viennent des tuiles OpenFreeMap. Ils sont décalés de 1,5 à 2 mm à côté des voies du site au lieu d'être centrés dessus. Ils n'ont pas de halo visible : en gris moyen, ils se perdent sur le bâti gris foncé et sur les traits des voies.
- Preuves :
  - Yoff A3, « Rue Ma Libasse Ndir » posé sur les toits, à côté de la 2×2 voies (recadrage 850-1150 × 650-1050 px) ;
  - Yoff A1, « Avenue Seydina Limamoulaye » traversé par les chaussées noires (recadrage 5600-7300 × 200-1600 px) ;
  - Médina 1/2 500, « Avenue Blaise Diagne » collé contre la voie primaire (2050-2550 × 1450-1900 px).
- Cause probable : le placement est celui du style Positron sur sa propre géométrie (tuiles z14), pas sur la couche voirie du site, et le halo du style est peu visible sur fond clair. Pistes : étiqueter la couche `osm-voirie` elle-même (champ `nom`, halo blanc), ou renforcer le halo des couches `symbol` dans `splitLabels`.

**N5 — Habillage non proportionné aux grands formats.** Gravité : important en A1, mineur en A2.
- Symptômes, sur Yoff A1 :
  - points de légende d'environ 1,4 à 1,8 mm, contre 3,7 mm sur la carte ;
  - traits de voirie de la légende plus fins que sur la carte ;
  - barre d'échelle de 1,6 mm d'épaisseur sous des chiffres de 14 pt ;
  - « Situation » en 2,2 mm et point rouge de 2,8 mm de diamètre dans un encart de 170 mm de large ;
  - étiquettes du fond à leur taille A3, donc presque invisibles à la lecture d'ensemble de l'A1.
- À l'inverse, en A4 (facteur 0,8), les symboles de voirie de la légende sont plus épais que sur la carte : « Voie primaire » apparaît comme un pavé noir.
- Le symbole « Emprise du site » en A4 est cassé : deux équerres rouges au lieu d'un rectangle en tirets (recadrage de la légende Fatick A4).
- Cause probable : `swatchSvg` utilise `PX_MM` au lieu du facteur `PXM` de la mise en page. L'encart et la barre d'échelle ont des tailles fixes en mm. Le fond est rendu avec un rapport de pixels `dpi/96`, sans tenir compte de `symbolScale`.

**N6 — La mer n'est pas représentée.** Gravité : mineur.
- Symptôme : le fond papier n'a pas d'eau. À Yoff, l'océan, en haut à gauche, est un aplat couleur papier (#f7f5f0), sans bleu, sans trait de côte et sans entrée de légende. On ne le distingue d'une zone non bâtie que par la limite de l'aplat « Habitat ».
- Preuve : Yoff A3, recadrage 110-1410 × 110-1210 px.

**N7 — Les courbes passent au-dessus du bâti.** Gravité : mineur.
- Symptôme : la couche « Courbes de niveau » est au-dessus du bâti Google dans la pile par défaut. Les courbes orange traversent les toits (Médina 1/1 000, îlot au sud-est ; Fatick A2, bâtiment administratif au nord-est du rond-point).

**N8 — Mise en page déséquilibrée.** Gravité : mineur.
- Symptômes :
  - cartouche vide aux deux tiers ou aux trois quarts sur les 6 planches ;
  - légende des formats portrait toujours sur une colonne : en Fatick A2, cadre de 159 mm de large pour 60 mm de texte ;
  - en portrait, flèche du nord et barre d'échelle coincées sous l'encart, avec une barre de 40 mm seulement en A2 ;
  - grand blanc entre le sous-titre et la carte en paysage (colonne de droite).

**N9 — Rendu du SVG variable selon la machine.** Gravité : mineur.
- Symptôme : le SVG n'inclut pas de police et se contente de `font-family="Inter, 'Helvetica Neue', Arial"`. Sur ce Mac, où seule Inter SemiBold est installée, Chromium affiche tout le texte courant en demi-gras. Les titres de groupe en gras sont alors à peine distincts : légende et cartouche du rendu Chromium de Fatick A4.
- Pistes : vectoriser le texte, ou inclure un `@font-face` en base64 dans le SVG.

### Évaluation d'ensemble

Le progrès est net. Les trois bloquants sont levés : mémoire, texte d'éditeur imprimé, cartouche superposé. Les autres acquis :
- échelle exacte dans les deux directions ;
- carte vectorielle dans le PDF et le SVG ;
- plus de doublons ;
- attributions propres.

Les planches au 1/2 500 et au 1/5 000 en A3 sont présentables.

Pour atteindre un niveau professionnel d'architecte, il manque surtout :
- la toponymie : noms de rues posés sur les voies avec halo, équipements et quartiers nommés ;
- une légende complète, avec les catégories « autres » et les courbes dans leur propre groupe ;
- un habillage proportionné au format : symboles de légende, encart, barre d'échelle, taille minimale du texte en A4 ;
- un sous-titre qui suit l'échelle ;
- un encart de situation digne de ce nom.

---

## 1er passage (archive)

Date du contrôle : 04/11/2026. Version contrôlée : build de production servi sur `localhost:3100` (dossier `.next-test`, BUILD_ID `1D90ESNoYPZUJrYQsX7BP`).

Méthode : trois sites créés par l'API, collecte lancée par l'interface (22 couches chacun), puis mises en page réglées dans l'éditeur (format, orientation, échelle) et exportées avec les boutons PNG 300 dpi, PDF et SVG. Chaque image a été ouverte et regardée : vue réduite de la planche entière, puis recadrages à pleine résolution du titre, de la légende, de la barre d'échelle, de la flèche du nord, du cartouche, de l'attribution et de zones denses. Les PDF ont été rastérisés avec `pdftoppm` à 100 et 300 dpi, et les SVG rendus dans Chromium.

Les mesures sont faites sur les PNG à 300 dpi :
- **Barre d'échelle** : longueur des segments pleins mesurée en pixels, puis convertie avec `mm = px / 300 × 25,4`.
- **Échelle réelle de la carte** : les équipements OSM sont des points de couleur unique. Leurs centres ont été retrouvés dans l'image, puis leur distance sur la page a été comparée à leur distance géodésique (pyproj, WGS 84), à la fois pour des paires de points et par composante est-ouest / nord-sud. Les tailles des emprises ont été recalculées à la géodésique : Médina 323,1 × 276,6 m ; Yoff 1 076,8 × 885,2 m ; Fatick 1 294,5 × 995,8 m.

### Incident pendant le contrôle (bloquant)

L'export **PNG A1 au 1/2 500** (Yoff) a fait tomber le serveur de production sur le port 3100. Le noyau a tué le processus `next-server` pour manque de mémoire (« Memory cgroup out of memory: Killed process 15046 (next-server) … anon-rss:10339712kB »). À ce moment, un export Fatick tournait en même temps. Les deux exports en cours ont échoué (`ERR_EMPTY_RESPONSE`, puis `ERR_CONNECTION_REFUSED`).

Comme demandé, je n'ai pas redémarré le serveur 3100. Pour terminer les deux mises en page manquantes, j'ai lancé une instance à part sur le port 3150 (`NEXT_DIST_DIR=.next-test next start -p 3150`, même build, sans compilation), et je l'ai arrêtée à la fin. Pendant l'export PNG A1 seul, la mémoire du serveur a atteint **10,4 Go**, mesurée toutes les 2 s dans `/proc/<pid>/status`. Les exports PDF et SVG du même A1 restent sous 1 Go.

Cause probable : `app/api/export/png/route.ts` rastérise toute la page d'un coup avec Resvg (9 933 × 7 016 px en RGBA), avec les tuiles PNG en base64 incluses dans le SVG, puis recode l'image avec sharp. Rien ne limite la mémoire ni le nombre d'exports simultanés. Un A0 à 300 dpi, ou deux A1 en même temps, suffit à tuer le serveur.

### Fichiers produits

| Site | Mise en page | PNG 300 dpi | PDF | SVG |
|---|---|---|---|---|
| Médina îlot (`controle-medina-ilot`) | A3 paysage 1/1 000 | `medina/medina_A3_paysage_1-1000.png` | `medina/medina_A3_paysage_1-1000.pdf` | `medina/medina_A3_paysage_1-1000.svg` |
| | A3 portrait 1/2 500 | `medina/medina_A3_portrait_1-2500.png` | `medina/medina_A3_portrait_1-2500.pdf` | — |
| Yoff (`controle-yoff`) | A3 paysage 1/5 000 | `yoff/yoff_A3_paysage_1-5000.png` | `yoff/yoff_A3_paysage_1-5000.pdf` | — |
| | A1 paysage 1/2 500 | `yoff/yoff_A1_paysage_1-2500.png` | `yoff/yoff_A1_paysage_1-2500.pdf` | `yoff/yoff_A1_paysage_1-2500.svg` |
| Fatick centre (`controle-fatick-centre`) | A2 portrait 1/5 000 | `fatick/fatick_A2_portrait_1-5000.png` | `fatick/fatick_A2_portrait_1-5000.pdf` | — |
| | A4 paysage 1/10 000 | `fatick/fatick_A4_paysage_1-10000.png` | `fatick/fatick_A4_paysage_1-10000.pdf` | `fatick/fatick_A4_paysage_1-10000.svg` |

Les dimensions des PNG sont exactes : A4 3 508 × 2 480 ; A3 4 961 × 3 508 ; A2 4 961 × 7 016 ; A1 9 933 × 7 016. La densité inscrite est de 300 dpi. Les PDF ont le bon format de page (pdfinfo). Les copies côté application se trouvent dans `data/sites/<slug>/exports/`.

Couches visibles (réglage par défaut) : emprise, tampon, équipements OSM, courbes de niveau, voirie OSM, bâtiments Google Open Buildings, bâtiments OSM, plans d'eau, cours d'eau, voies ferrées, espaces verts, occupation du sol. Fond « clair » (OpenFreeMap).

### Constats communs à tous les exports

Ces défauts reviennent sur toutes les planches. Les fiches par export y renvoient par leur code C1 à C14.

- **C1. Le fond de carte et les couches du site sont doublés et décalés.** Gravité : important.
  - Le bâti Google Open Buildings (gris à 55 %) et le bâti OSM (anthracite à 90 %) sont visibles ensemble. Ils se superposent avec un décalage de 1 à 3 m. On obtient un effet d'ombre portée et des zones marbrées illisibles. Preuve : recadrages Médina 1/1 000, zone dense à gauche, et Fatick A2, centre.
  - Les voies OSM sont tracées à côté de la chaussée du fond, qui n'est pas masquée. On voit deux tracés parallèles, gris clair et gris foncé.
  - Les espaces verts du fond (vert foncé) et ceux d'OSM (vert clair) apparaissent ensemble, par exemple en haut de Médina 1/2 500.
  - Les plans d'eau du fond et ceux d'OSM sont dans deux bleus qui se superposent (Fatick A2, en haut à droite).
  - Cause probable : couches visibles par défaut redondantes, et fond OpenFreeMap qui garde ses bâtiments, ses chaussées et son eau sous les couches du site.
- **C2. Les noms de rues sont barrés par les voies.** Gravité : important.
  - Les étiquettes viennent du fond raster, mais les couches du site sont dessinées par-dessus.
  - Exemples : « Avenue Blaise Diagne » traversée par la ligne de la voie primaire, « Rue Dial Diop » et « Rue Ambroise Mendy » à Médina, « Rue Mamadou Libasse Ndir » à Yoff, cartouche de route nationale à moitié couvert à Fatick A2 et A4.
  - Cause probable : dans `lib/layout/basemap.ts`, `siteRasterStyle` insère les couches du site au-dessus des couches de symboles du fond. Il faudrait les insérer sous la première couche `symbol`.
- **C3. La toponymie est trop faible pour des planches d'urbanisme.**
  - Les noms viennent uniquement du fond. Ils sont gris, petits et rares : à Yoff 1/2 500 on lit à peine un nom (« Rue 498 ») sur 1,5 km de large, et à Fatick il n'y a presque aucun nom de rue.
  - Aucun équipement n'est nommé, aucun quartier n'est indiqué.
  - Gravité : important.
- **C4. Les courbes de niveau sont illisibles.**
  - Elles sont tirées du MNT à 30 m : tracés polygonaux grossiers, petites boucles fermées, aucune cote d'altitude.
  - Au 1/1 000 elles traversent les bâtiments et n'apportent rien. À Fatick (équidistance de 1 m), au 1/10 000, elles forment un réseau très dense qui brouille la carte.
  - Il n'y a ni courbes maîtresses ni lissage, et la densité ne s'adapte pas à l'échelle.
  - Gravité : important.
- **C5. La carte n'est pas tout à fait isométrique (Pseudo-Mercator).**
  - Les points sont placés exactement à l'endroit prévu par une projection Web Mercator avec facteur cos(latitude du centre) : écart inférieur à 0,4 px sur plus de 25 points. Les distances réelles ne sont pourtant pas les mêmes dans les deux sens.
  - Est-ouest, l'échelle est exacte : Médina, 114,89 mm sur le papier pour 114,91 m au sol en arc de parallèle, rapport 0,9998.
  - Nord-sud, la carte est agrandie de **0,63 %** : Médina, 250,53 mm sur le papier pour 248,96 m au sol en arc de méridien, soit 1/994 au lieu de 1/1 000.
  - Échelles mesurées sur des diagonales de points : Médina 1/995 (1/1 000 annoncé) et 1/2 493 (1/2 500), Yoff 1/4 987 et 1/2 494, Fatick 1/4 990 et 1/10 011.
  - Cause : Web Mercator est sphérique, alors que le rayon de méridien WGS 84 à 14,7° N vaut 6 339 560 m contre 6 378 137 m pour la sphère.
  - Conséquence : sur un A3 au 1/1 000, 1,7 mm d'erreur en nord-sud. La barre d'échelle, horizontale, ne le montre pas. Pour un plan coté, il faudrait projeter en UTM 28N, la projection déjà annoncée pour les mesures.
  - Gravité : important pour un rendu professionnel, sans gêne pour un plan de situation.
- **C6. La carte des PDF et des SVG est une image raster.**
  - Dans les PDF, la carte est faite de tuiles de 2 047 × 2 047 px à **200 ppi** (`pdfimages -list` : 1 à 9 tuiles selon le format). Dans les SVG, ce sont 1 à 9 balises `<image>` en base64.
  - Les bâtiments, les voies et les points ne sont pas des objets vectoriels : on ne peut pas les reprendre dans Illustrator ou Inkscape, et les traits sont moins fins qu'à 300 dpi.
  - Seuls la mise en page, la légende et la carte de situation sont vectoriels (514 `path` dans le SVG de Médina, alors que le site compte 2 585 + 532 bâtiments).
  - Gravité : important, puisque le SVG est justement attendu pour une reprise en PAO.
- **C7. Les PDF ont une police CID mal déclarée.**
  - L'objet `/CIDSystemInfo` contient `/Ordering (Identity-H)` au lieu de `(Identity)`. poppler affiche « Unknown character collection 'Adobe-Identity-H' » sur les 6 PDF.
  - Installer `poppler-data` (fait) ne supprime pas l'erreur. Le texte s'affiche quand même.
  - Inter est incluse en entier, sans sous-ensemble (`pdffonts` : emb yes, sub no), ce qui alourdit les fichiers.
  - Cause probable : enregistrement de la police dans jsPDF 4.2.1 (encodage passé comme « Ordering »). Certains outils de contrôle d'impression peuvent rejeter le fichier.
  - Gravité : mineur à important.
- **C8. L'attribution est répétée, redondante et déborde.**
  - Le même texte complet est imprimé deux fois : en bas de la carte et dans le cartouche.
  - « © les contributeurs d'OpenStreetMap » apparaît deux fois dans la même phrase.
  - En bas de la carte, le fond blanc semi-transparent est plus étroit que le texte : sur Médina A3 paysage, « So » de « Sources » déborde à gauche sur le bâti.
  - Dans le PDF de Médina A3, le texte est coupé au bord droit du cadre (« … 2014-2018, fourn »).
  - Gravité : important pour le texte coupé, mineur pour le reste.
- **C9. Le texte du cartouche dépasse son cadre.**
  - La largeur du texte est estimée par `textWidth()` avec des coefficients approximatifs. Le texte réel en Inter est plus large : la ligne « Sources … © les » dépasse le bord droit du cartouche sur Yoff A1 en PNG, PDF et SVG, et touche le bord sur Médina A3 paysage.
  - Gravité : important.
- **C10. Le cartouche est pauvre et mal équilibré.**
  - Il manque l'auteur ou le bureau d'études, le maître d'ouvrage, le numéro de planche, l'indice et la phase. La ligne « Auteur » vide est omise.
  - Les deux tiers inférieurs sont vides sur toutes les planches.
  - Le sous-titre par défaut est toujours « Plan de situation », même au 1/1 000 où il s'agit d'un plan masse.
  - Gravité : mineur.
- **C11. La légende contient des entrées hors champ.**
  - « Zone tampon de 300 m / 500 m » apparaît alors que le tampon est hors du cadre sur 5 planches sur 6. Sur Médina 1/1 000, l'emprise elle-même est hors champ (323 m de large pour 296 m de cadre) mais reste en légende.
  - Les entrées de la légende viennent des couches visibles et non de ce qui est réellement dans l'emprise de la carte.
  - Pour les classes, c'est correct : les catégories absentes sont bien retirées (par exemple pas de « Voie secondaire » ni de « Sport et loisirs » à Yoff), et les plans d'eau vides ne sont pas listés.
  - Gravité : mineur.
- **C12. La légende est mal hiérarchisée.**
  - « Courbes de niveau » est rangé sans titre sous le groupe « Équipements (OSM) » et paraît en faire partie.
  - L'ordre suit l'ordre des couches et non une logique de lecture (limites, bâti, voirie, équipements, milieu naturel).
  - La couleur de « Occupation du sol (OSM) » (#e7e5e4 à 60 %) est presque identique au fond, sur la carte comme dans la légende. Une même teinte grise couvre des natures très différentes (plage, résidentiel, stade, station-service, militaire, friche).
  - Gravité : mineur à important.
- **C13. La carte de situation est sommaire.**
  - Elle montre le Sénégal seul, sans pays voisins, sans océan et sans nom.
  - Le point rouge est collé au bord gauche du cadre et masque la presqu'île du Cap-Vert pour les sites de Dakar.
  - Il n'y a pas de rectangle d'emprise et pas d'échelle.
  - Gravité : mineur.
- **C14. Les noms de fichiers sont trompeurs.**
  - Tous les exports s'appellent `…-planche-a3-A2-…`, `…-planche-a3-A4-…`, etc. La mise en page garde le nom « Planche A3 » quel que soit le format.
  - Changer de format modifie la mise en page unique du site au lieu d'en créer une nouvelle.
  - Les PNG sont en RGBA alors qu'ils sont entièrement opaques (alpha = 255 partout) : poids inutile.
  - Gravité : mineur.

Points conformes partout :
- Barres d'échelle exactes.
- Flèche du nord présente.
- Titre lisible.
- Légende dans les bonnes couleurs, alignées sur la carte : contrôle des 7 couleurs d'équipements par recherche de couleur exacte.
- Points d'équipement de 1,9 mm avec liseré blanc, bien lisibles.
- Emprise en tirets rouges nette.
- Attributions complètes : OpenFreeMap, OpenMapTiles, OSM, Copernicus DEM, Google Open Buildings.
- Pas de transparence parasite.

---

### Médina îlot — A3 paysage 1/1 000 (PNG, PDF, SVG)

**Ce qui va**
- Barre 0-25-50 m : segment plein de 593 px, soit **50,2 mm** pour 50 mm attendus. L'écart vient du contour.
- Positions des 7 équipements dans le cadre conformes à 0,4 px près.
- Bâti bien lisible au 1/1 000.
- Titre en 20 pt, légende en 7,5 pt, lisibles.

**Défauts**
1. **Bloquant — la mention d'éditeur « … légende incomplète : agrandissez le cadre » est imprimée en rouge dans la planche** (PNG, PDF et SVG ; texte présent dans le SVG). Il manque au moins « Occupation du sol (OSM) », alors que les polygones gris clair sont visibles en haut de la carte. Cause : `lib/layout/svg.ts:435`, qui écrit l'avertissement dans le rendu au lieu de le réserver à l'interface. Le cadre de légende par défaut n'est pas dimensionné pour le nombre d'entrées.
2. Important — doublement et décalage du bâti Google et OSM (C1). C'est très visible à cette échelle : la moitié des îlots ont une « ombre » décalée de 1 à 3 m. Preuve : recadrage de la zone 120-1500 × 900-2200 px.
3. Important — noms de rues barrés (C2) : « Avenue Blaise Diagne » et « Rue Dial Diop » (recadrage 2300-3615 × 100-1000 px).
4. Important — la carte ne montre pas l'emprise du site, plus large que le cadre (323 m pour 296 m), alors que la légende l'annonce (C11). Le cadrage par défaut, centré sur le centre du site, ne prévient pas que l'emprise déborde.
5. Important — courbes à 2 m tirées d'un MNT à 30 m, qui traversent le bâti sans cote (C4).
6. Important — PDF : attribution coupée à droite (« fourn ») ; carte raster à 200 ppi (C6, C8).
7. Important — anisotropie nord-sud de 0,63 % (C5).
8. Mineur — « Plan de situation » comme sous-titre d'un plan au 1/1 000 ; cartouche vide aux deux tiers (C10).
9. Mineur — le texte des sources touche le bord droit du cartouche (C9).
10. Mineur — SVG : carte en 4 images raster, police non incluse (`font-family` Inter, puis Helvetica ou Arial selon la machine) (C6).

### Médina îlot — A3 portrait 1/2 500 (PNG, PDF)

**Ce qui va**
- Barre 0-50-100 m : 475 px, soit **40,2 mm** pour 40 mm attendus.
- 24 équipements retrouvés à 0,2 px près ; échelle mesurée sur une diagonale de 786 m : 1/2 493.
- Emprise de 129 mm de large (323 m), visible et nette.
- Légende complète, sans avertissement.

**Défauts**
1. Important — noms barrés : « Avenue Blaise Diagne », « Avenue Malick Sy », « Rue Dial Diop » ; doubles espaces verts du fond et d'OSM au nord ; double bâti (C1, C2).
2. Important — courbes à 2 m très présentes, sans cote (C4).
3. Mineur — deux points « Transport » à 1,5 m l'un de l'autre se chevauchent (tache unique de 507 px), comme deux points « Sport et loisirs ». Il n'y a ni décalage ni regroupement des points proches.
4. Mineur — « Zone tampon de 300 m » en légende, mais le tampon est hors cadre (C11).
5. Mineur — mise en page déséquilibrée :
   - grand blanc sous le titre ;
   - flèche du nord et barre d'échelle très petites (6,5 pt), coincées sous la carte de situation ;
   - cartouche vide aux trois quarts ;
   - légende avec une demi-colonne vide (C10).
6. Mineur — carte de situation : le point de Dakar est collé au bord gauche et masque le Cap-Vert (C13).
7. Important — PDF : carte raster à 200 ppi ; police CID mal déclarée (C6, C7).

### Yoff — A3 paysage 1/5 000 (PNG, PDF)

**Ce qui va**
- Barre 0-100-200 m : 475 px, soit **40,2 mm** pour 40 mm attendus.
- Emprise mesurée sur la page à 215 × 178 mm, contre 215,4 × 177,0 mm attendus ; diagonale de 1 784 m mesurée à 1/4 987.
- La légende suit bien les classes présentes : pas de « Voie secondaire », pas de « Sport et loisirs », « Cours d'eau » présent (1 objet).

**Défauts**
1. Important — l'emprise, l'aéroport de Yoff, est couverte par l'« Occupation du sol » militaire, grise sur un fond gris. La piste et le site se lisent mal et la légende ne permet pas de distinguer cette surface (C12).
2. Important — noms barrés : « Rue Mamadou Libasse Ndir » est coupée par la 2×2 voies ; la voie primaire en 4 traits noirs épais (chaussées et bretelles) écrase la lecture (C2).
3. Important — presque aucun nom de rue n'est lisible à cette échelle (C3).
4. Mineur — le plan d'eau du fond (en haut à gauche, gris-bleu) n'a pas d'entrée de légende et sa couleur diffère de celle des « Plans d'eau (OSM) ».
5. Mineur — « Zone tampon » en légende alors qu'on n'en voit qu'un fragment pointillé dans l'angle (C11).
6. Important — PDF : carte raster à 200 ppi ; police CID mal déclarée (C6, C7).

### Yoff — A1 paysage 1/2 500 (PNG, PDF, SVG)

**Ce qui va**
- Barre 0-100-200 m : 947 px, soit **80,2 mm** pour 80 mm attendus.
- Diagonale de 1 784 m mesurée à 1/2 494.
- Le rendu de la carte est net à 300 dpi : traits et points à leur taille physique.

**Défauts**
1. **Bloquant — l'export PNG a pris 10,4 Go de mémoire et a fait tomber le serveur de production** (voir l'incident ci-dessus).
2. **Bloquant — les libellés et les valeurs du cartouche se chevauchent** : « ÉCHELLE1/2 500 » et « PROJECTWGS 84… » s'impriment l'un sur l'autre (recadrage 7350-9300 × 5100-5900 px ; même chose dans le PDF et le SVG). Cause : `lib/layout/svg.ts`, `renderCartouche`, où `labW = Math.min(18, el.w * 0.28)` fixe la colonne des libellés à 18 mm au plus alors que la police passe à 13 pt en A1. Il faudrait calculer la largeur à partir du libellé le plus long.
3. Important — la ligne des sources dépasse le bord droit du cartouche (« © les » hors du cadre) dans les trois formats (C9).
4. Important — les tailles ne suivent pas le format :
   - textes de la légende et du cartouche agrandis (15 et 13 pt), mais symboles de légende restés petits : points de légende d'environ 10 px contre 22 px sur la carte, barre d'échelle de 1,7 mm d'épaisseur sous des chiffres de 14 pt ;
   - attribution en bas de carte de taille A3 (environ 5 pt) sur un A1 ;
   - libellé « Situation » minuscule.
5. Important — même couverture et même densité que l'A3 au 1/5 000, sans gain d'information : toponymie quasi absente à 1/2 500 sur un A1 (C3).
6. Important — SVG et PDF : la carte est faite de 9 tuiles raster ; le PDF est à 200 ppi (C6).
7. Mineur — dans la légende, le symbole de « Zone tampon de 300 m » est presque invisible : pointillé gris très fin.

### Fatick centre — A2 portrait 1/5 000 (PNG, PDF)

**Ce qui va**
- Barre 0-100-200 m : 40 mm attendus, conforme (même gabarit que les autres, mesure à 0,5 px près).
- Diagonale de 2 149 m mesurée à 1/4 990.
- Plans d'eau et espace vert bien rendus et cohérents avec la légende.
- Légende complète.

**Défauts**
1. Important — « PROJECTION » est collé à sa valeur (« PROJECTIONWGS 84 »), sans espace (recadrage 3300-4961 × 5300-5700 px). Même cause que pour Yoff A1 (`labW` limité à 18 mm).
2. Important — double bâti Google et OSM décalé, qui donne un aspect « en relief » sur tout le tissu ; double bleu des plans d'eau (C1).
3. Important — courbes à 1 m très denses, en boucles sans cote (C4).
4. Important — aucun nom de rue ou de quartier lisible ; cartouche de route nationale barré (C2, C3).
5. Mineur — mise en page : grand blanc entre le sous-titre et la carte ; légende sur une colonne dans un cadre deux fois trop large ; cartouche vide aux deux tiers (C10).
6. Mineur — « Courbes de niveau (1 m) » rangé sous « Équipements (OSM) » (C12) ; « Zone tampon de 500 m » hors cadre (C11).
7. Important — PDF : carte raster à 200 ppi ; police CID mal déclarée (C6, C7).

### Fatick centre — A4 paysage 1/10 000 (PNG, PDF, SVG)

**Ce qui va**
- Barre 0-250-500 m : 590 px, soit **49,9 mm** pour 50 mm attendus.
- Emprise de 129,5 mm (1 295 m) ; diagonale de 2 460 m mesurée à 1/10 011.
- Le PNG, le PDF et le SVG sont visuellement identiques (comparaison superposée).

**Défauts**
1. **Bloquant — la mention « … légende incomplète : agrandissez le cadre » est imprimée en rouge.** Manquent : Bâtiments (OSM), Plans d'eau (OSM), Espaces verts (OSM) et Occupation du sol (OSM), pourtant bien visibles sur la carte (eau en bleu, stade en vert, gros bâtiments OSM à l'est).
2. Important — rien n'est simplifié pour le 1/10 000 :
   - voies de desserte en traits sombres de 1,2 px, qui forment un maillage noir dominant ;
   - bâti réduit à des confettis ;
   - courbes à 1 m qui couvrent toute la carte.
   Le résultat est chargé et sans hiérarchie (recadrage 1100-2100 × 1000-2000 px).
3. Important — attribution sur 3 lignes dans la carte, qui masque une bande de bâti en bas, en plus du même texte dans le cartouche (C8).
4. Important — cartouche de route nationale barré par la voie primaire (C2).
5. Important — SVG et PDF : la carte est une image raster (1 tuile) à 200 ppi dans le PDF (C6).
6. Mineur — « Zone tampon de 500 m » est en légende alors qu'on n'en voit qu'un pointillé en bas à gauche (C11).

---

### Synthèse des défauts à corriger, par priorité

**Priorité 1 — bloquants**
1. **Stabilité de l'export PNG grand format.** 10,4 Go de mémoire pour un A1 à 300 dpi, et serveur tué quand un autre export tourne en même temps. Pistes : rendu par bandes, ou limite en mégapixels avec repli à une résolution plus basse ; file d'attente d'un seul export à la fois ; tuiles du fond non incluses en base64. Fichier : `app/api/export/png/route.ts`.
2. **Avertissement d'éditeur imprimé dans la planche** (« légende incomplète : agrandissez le cadre ») et légende tronquée : Médina A3 1/1 000, Fatick A4 1/10 000. Il faut ne jamais imprimer ce texte, dimensionner automatiquement le cadre de légende, ou passer sur 2 colonnes et réduire la taille. Fichier : `lib/layout/svg.ts:435`.
3. **Cartouche : libellés et valeurs qui se chevauchent** en A2 et A1. La colonne des libellés est limitée à 18 mm (`labW`) ; il faut la calculer à partir du libellé le plus long à la taille de police réelle.

**Priorité 2 — importants**
4. Couches du site dessinées au-dessus des étiquettes du fond, ce qui barre les noms de rues : insérer les couches du site sous la première couche `symbol` du fond.
5. Doublons visibles par défaut : bâti Google et bâti OSM superposés et décalés, chaussées, espaces verts et eau du fond sous les couches OSM. Il faut n'afficher par défaut qu'une source de bâti, ou Google seulement là où OSM manque, et un fond « épuré » sans bâti ni eau pour les mises en page.
6. Mesure de la largeur des textes trop optimiste (`textWidth`) : sources qui dépassent du cartouche (A1, A3) et attribution coupée dans le PDF. Il faut mesurer avec les métriques réelles de la police, ou prendre une marge de 10 à 15 %.
7. Carte raster dans les PDF (200 ppi) et les SVG (tuiles base64) : prévoir au moins une option vectorielle pour les couches du site, et 300 ppi pour le PDF d'impression.
8. Projection Pseudo-Mercator : échelle nord-sud fausse de 0,63 % (1/994 au lieu de 1/1 000). Proposer une mise en page en UTM 28N (EPSG:32628) pour les plans cotés.
9. Courbes de niveau : lissage, courbes maîtresses cotées, équidistance adaptée à l'échelle ; ne pas les afficher par défaut au-dessous du 1/2 000.
10. Simplification selon l'échelle : épaisseur des voies et densité des courbes à adapter au 1/5 000 et au 1/10 000 ; tailles des symboles de légende, de la barre d'échelle et de l'attribution proportionnelles au format.
11. Toponymie : étiquettes des voies OSM (nom), des équipements et des quartiers, au-dessus des couches.
12. Attribution : une seule occurrence (dans le cartouche ou dans la carte), sans répéter « © les contributeurs d'OpenStreetMap », et un fond blanc qui couvre bien tout le texte.
13. Occupation du sol : style par catégorie au lieu d'un gris unique presque égal au fond.

**Priorité 3 — mineurs**
14. Police CID des PDF mal déclarée (`/Ordering (Identity-H)`, jsPDF) ; police Inter incluse en entier, sans sous-ensemble.
15. Légende : retirer les entrées hors champ (tampon, emprise) ; donner un titre au groupe « Courbes de niveau » ; suivre un ordre de lecture logique.
16. Cartouche : ajouter auteur ou bureau d'études, maître d'ouvrage, numéro et indice de planche ; sous-titre par défaut selon l'échelle (« Plan masse » au 1/1 000, « Plan de situation » au-delà de 1/10 000) ; mieux occuper l'espace.
17. Carte de situation : pays voisins, océan, rectangle d'emprise, point qui ne colle pas au bord.
18. Points d'équipement superposés : décalage ou regroupement des points proches.
19. Nom de la mise en page « Planche A3 » repris dans les fichiers A1, A2 et A4 ; PNG en RGBA alors qu'ils sont opaques.
