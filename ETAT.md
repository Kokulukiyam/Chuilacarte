# État d'avancement (mis à jour à chaque étape)

Branche : `claude/chuilacarte`. Avancement global : 100 % du périmètre (défauts mineurs listés). Dépôt distant : https://github.com/Kokulukiyam/Chuilacarte (branche `claude/chuilacarte`, poussée après chaque commit).

## Fait
- Étapes 1 à 8 de SPEC.md implémentées et commitées (socle, sources + collecte, couches/styles/édition, annotations/mesures, mise en page + exports, pont QGIS, analyses, implantation 3D/ombres). README rédigé.
- `SOURCES.md` produit par l'agent de vérification des sources.
- Contrôle QGIS (agent) : 3 passages, plus que des défauts mineurs → `exemples/CONTROLE_QGIS.md`.
- Contrôle des données (agent) : 2 passages, plus que des défauts mineurs (zone tampon des anciens sites régénérée à l'ouverture depuis).
- Contrôle cartographique (agent) → `exemples/CONTROLE_CARTOGRAPHIQUE.md` (19 défauts). Corrigés : PNG par bandes + un export à la fois, échelle exacte ellipsoïdale (N-S 0,6 % corrigé), légende auto-ajustée (plus de message rouge imprimé), cartouche (largeur des libellés, champs MOA/phase/planche), attributions dédoublonnées (sources dans le cartouche, pas en double), étiquettes du fond au-dessus des couches (écran et export), fond « Papier + noms de rues » par défaut dans les mises en page, facteur d'épaisseurs/symboles par format, occupation du sol catégorisée (+ aéroport), courbes lissées et cotées, sous-titre selon l'échelle, nom de planche suivant le format, bâti OSM masqué par défaut (Google affiché).

## Reste à faire
Toutes les étapes de SPEC.md sont terminées (1 à 10).
1. Contrôle cartographique : 7 passages. Plus aucun défaut bloquant ni important (dernier passage : 12/11/2026). Exports définitifs dans `exemples/medina|yoff|fatick/`.
2. Test de bout en bout : 39/39 étapes OK, 0 erreur console ou serveur (relancé après chaque série de corrections, dernier passage le 12/11/2026).
3. `RAPPORT.md` et README à jour.

Défauts mineurs restants (voir le 7e passage et `RAPPORT.md`) : nom de l'aéroport de Yoff long et débordant ; nom d'une surface qui peut couvrir son point ; numéro de planche figé à l'export ; courbes issues d'un MNS à 30 m (inutiles au 1/1 000) ; Identity-H dans les PDF ; rues de Fatick sans nom dans OSM.

## Défauts connus non traités (mineurs)
- Le fond vectoriel est rastérisé dans les PDF/SVG (choisir le fond « Papier » pour un export 100 % vectoriel).
- PDF : polices en Identity-H (avertissement poppler sans conséquence).
- Import d'un GeoPackage exporté : les tables séparées par type de géométrie reviennent en plusieurs couches.

## Session locale (04/11/2026, Mac)
- Build de production réparé en local : configuration ESLint d'un dossier parent ignorée, racine du projet fixée, `scripts/test-server.sh` compatible macOS (`lsof`).
- Playwright 1.64.1 ajouté en devDependency (script de bout en bout : `tests/e2e/bout-en-bout.ts`).
- Relancés : l'agent de bout en bout (serveur 3500) et l'agent cartographique, 2e passage (serveur 3600, sites `exemple-medina|yoff|fatick`).

## Session locale (12/11/2026) : défauts restants traités
- Encart de situation avec pays voisins, océan et noms (sans clipPath : un clipPath faisait planter resvg pendant l'export PNG par bandes, ce qui tuait le serveur ; test de non-régression ajouté).
- Étiquettes par défaut des équipements et des grandes emprises (4 positions, jamais hors cadre, pas de doublon à moins de 40 mm, 5,5 pt minimum), points voisins écartés.
- Légende : retrait sous les titres de groupe, groupes non coupés, seulement ce qui est dans le cadre. Cartouche : numéro de planche. Noms de planche uniques par format.
- SVG avec police incluse ; noms du fond agrandis selon le format.
- Contrôle cartographique, passages 6 et 7 ; test de bout en bout 39/39.

## Session locale (14/11/2026) : refonte de l'interface
- Socle visuel : neutres chauds, accent terre cuite, contrôles de formulaire, infobulles avec raccourcis (`app/globals.css`, `components/ui/`). Choix détaillés dans DECISIONS.md.
- Dialogues de l'application à la place de prompt/confirm/alert ; suppression de couche ou de planche annulable depuis le message.
- Accueil : recherche, tri, cartes de site, état vide. Espace de travail : barre d'outils regroupée, palette de commandes (Ctrl/⌘ K), aide de l'outil actif, barre d'état (coordonnées, échelle approchée), clic droit sur la carte, recadrage sur le site, glisser-déposer de fichiers, panneaux repliables.
- Couches : recherche, filtre « affichées », largeur réglable, Alt + clic pour isoler. Table attributaire : hauteur réglable, export CSV.
- Mise en page : export toujours visible, flèches / Suppr / Ctrl + molette.
- Vérifié : `tsc` vide, 35 tests unitaires, bout en bout 39/39 sans erreur console ni serveur.
- Captures clair / sombre relues (`npx tsx scripts/captures.ts [url] [dossier] [site]`) ; RAPPORT.md à jour. Reste possible : relecture de l'interface par un agent distinct, et réorganisation plus poussée des panneaux Style, Analyse et Projet (seulement rhabillés).

## Tests manuels rapides
`scripts/test-server.sh 3400` puis ouvrir http://localhost:3400. Sites de test présents en local (non versionnés) : exemple-medina, exemple-yoff, exemple-fatick.

## Comment reprendre (Claude Code, en local)
1. `git clone https://github.com/Kokulukiyam/Chuilacarte && cd Chuilacarte && git checkout claude/chuilacarte && npm install` (puis `npx playwright install chromium` pour le test de bout en bout).
2. Les sites (`data/sites/`) ne sont pas versionnés. Pour refaire les planches d'exemple, recréer les 3 sites : Médina îlot [[-17.4475,14.6745],[-17.4445,14.6770]] tampon 300 m ; Yoff [[-17.4880,14.7480],[-17.4780,14.7560]] 300 m ; Fatick [[-16.4180,14.3330],[-16.4060,14.3420]] 500 m. Collecter, puis exporter les 6 planches (voir le tableau de `exemples/CONTROLE_CARTOGRAPHIQUE.md`).
3. Vérifier : `npx tsc --noEmit`, `npm test`, `scripts/test-server.sh 3500` puis `npx tsx tests/e2e/bout-en-bout.ts http://localhost:3500` (environ 10 min, crée puis supprime ses sites `e2e-*`).
4. Toujours : commit + push après chaque étape, ETAT.md à jour.
