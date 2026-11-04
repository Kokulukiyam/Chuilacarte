# Chuilacarte — contexte pour Claude Code

Lis d'abord `SPEC.md` (la demande), puis `ETAT.md` (où on en est, ce qui reste à faire), puis `DECISIONS.md`.

## Projet
Outil cartographique local (Next.js 15 App Router + TypeScript + Tailwind 4, MapLibre 5, Terra Draw, Turf, DuckDB spatial côté serveur). Interface et textes en français. Données dans `data/sites/<slug>/` (site.json + layers/*.geojson + files/ + exports/), non versionné.

## Commandes
- `npm install` puis `npm run dev` (port 3000).
- `npm test` : tests unitaires vitest (`tests/unit/`), doivent tous passer.
- `npx tsc --noEmit` : vérification de types, doit être vide.
- `scripts/test-server.sh <port>` : build de production isolé (`.next-test-<port>`) servi sur ce port, pour les tests Playwright (le serveur de dev recharge la page à chaque modification de fichier, ce qui casse les tests).
- Fixtures de test : `tests/fixtures/` (GeoJSON, KML, GPKG UTM, Shapefile zippé, CSV, DXF UTM, DXF local de projet). `npx tsx scripts/make-fixtures.ts` régénère les DXF.

## Architecture (fichiers clés)
- `lib/types.ts` modèle (Site, Layer, LayerStyle, Layout…). `lib/store.ts` état zustand + annuler/rétablir (instantanés immuables). `lib/autosave.ts` sauvegarde auto.
- Carte : `components/MapView.tsx`, `lib/maplayers.ts` (couches du site → MapLibre), `lib/mapbase.ts` + `lib/basemaps.ts` (fonds), `lib/draw.ts` (Terra Draw), `lib/tools.ts` (registre d'outils), `lib/annotate.ts`, `lib/edit.ts`, `lib/analysisTools.ts`, `lib/projectTools.ts`.
- Panneaux : `components/Workspace.tsx`, `Toolbar.tsx`, `LayersPanel.tsx`, `LayerPanel.tsx` (+ `StyleEditor`, `EditSection`, `AnnotationProps`, `LegendSection`), `AnalysisPanel`/`AnalysisTools.tsx`, `ProjectPanel.tsx`, `SitePanel.tsx`, `CollectDialog.tsx`, `LayoutEditor.tsx`, `BottomPanel.tsx` (table attributaire).
- Collecte serveur : `lib/server/collect/*.ts` (osm, overture, openbuildings, admin, relief, rasters) + route `app/api/sites/[slug]/collect` (flux NDJSON ; le client ajoute les couches à site.json).
- Mise en page / exports : `lib/layout/` (geo = projection et échelle exacte ellipsoïdale, svg = rendu SVG en mm, legend, basemap = rendu du fond hors écran par morceaux, export = SVG/PDF/PNG), route PNG `app/api/export/png` (resvg par bandes).
- Données/QGIS : `lib/server/gpkg.ts` (écrivain GeoPackage), `lib/server/qgis.ts` (QML), `lib/server/qgisProject.ts` (projet .qgs), `lib/server/exportLayers.ts`, `lib/dxf-write.ts`, `lib/dxf-read.ts`, `lib/server/importers.ts`.
- Analyses : `lib/analysis.ts` (synthèse UTM), `lib/shadows.ts`, `lib/placement.ts` (calage Helmert).

## Conventions
- Coordonnées stockées en WGS84 ; mesures en UTM du site (`lib/proj.ts`).
- Attributs internes préfixés `_` (`_fid`, `_kind`, `_local`…) masqués et retirés des exports.
- Le test `window.__map`, `window.__store`, `window.__draw()` est exposé pour Playwright.
- Commit après chaque étape (messages en français). Pas de remote git configuré au départ.
