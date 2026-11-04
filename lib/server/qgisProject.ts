import 'server-only';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';
import { basemapById } from '../basemaps';
import { TILE_SOURCES } from '../tilesources';
import { utmProj4 } from '../proj';
import { bufferedEmprise } from '../site';
import type { Layer, Site } from '../types';
import { buildGpkg, collectExportLayers } from './exportLayers';
import { utmWkt } from './gpkg';
import { esc, layerQml } from './qgis';
import { siteFile, slugify } from './storage';
import { projectGeometry } from '../proj';

function srsXml(epsg: number) {
  if (epsg === 4326)
    return `<spatialrefsys nativeFormat="Wkt"><wkt>GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563]],CS[ellipsoidal,2],AXIS["latitude",north],AXIS["longitude",east],UNIT["degree",0.0174532925199433],ID["EPSG",4326]]</wkt><proj4>+proj=longlat +datum=WGS84 +no_defs</proj4><srsid>3452</srsid><srid>4326</srid><authid>EPSG:4326</authid><description>WGS 84</description><projectionacronym>longlat</projectionacronym><ellipsoidacronym>EPSG:7030</ellipsoidacronym><geographicflag>true</geographicflag></spatialrefsys>`;
  if (epsg === 3857)
    return `<spatialrefsys nativeFormat="Wkt"><wkt></wkt><proj4>+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs</proj4><srsid>3857</srsid><srid>3857</srid><authid>EPSG:3857</authid><description>WGS 84 / Pseudo-Mercator</description><projectionacronym>merc</projectionacronym><ellipsoidacronym>EPSG:7030</ellipsoidacronym><geographicflag>false</geographicflag></spatialrefsys>`;
  const south = epsg > 32700;
  const zone = epsg - (south ? 32700 : 32600);
  return `<spatialrefsys nativeFormat="Wkt"><wkt>${esc(utmWkt(epsg))}</wkt><proj4>${esc(utmProj4({ zone, south, epsg }))}</proj4><srid>${epsg}</srid><authid>EPSG:${epsg}</authid><description>WGS 84 / UTM zone ${zone}${south ? 'S' : 'N'}</description><projectionacronym>utm</projectionacronym><ellipsoidacronym>EPSG:7030</ellipsoidacronym><geographicflag>false</geographicflag></spatialrefsys>`;
}

/** Extrait <renderer-v2>…<labeling> d'un QML pour l'insérer dans un projet. */
function qmlBody(qml: string) {
  const r = qml.match(/<renderer-v2[\s\S]*<\/renderer-v2>/)?.[0] || '';
  const l = qml.match(/<labeling[\s\S]*<\/labeling>/)?.[0] || '';
  return `${r}\n${l}`;
}

const QGIS_GEOM: Record<string, string> = { POINT: 'Point', MULTIPOINT: 'Point', LINESTRING: 'Line', MULTILINESTRING: 'Line', POLYGON: 'Polygon', MULTIPOLYGON: 'Polygon', GEOMETRY: 'Unknown' };
const WKB_TYPE: Record<string, string> = { POINT: 'Point', MULTIPOINT: 'MultiPoint', LINESTRING: 'LineString', MULTILINESTRING: 'MultiLineString', POLYGON: 'Polygon', MULTIPOLYGON: 'MultiPolygon', GEOMETRY: 'Unknown' };

interface PL {
  id: string;
  name: string;
  xml: string;
  visible: boolean;
}

/**
 * Construit le dossier « QGIS » d'un site : GeoPackage (UTM, styles intégrés), images calées (PNG + world file),
 * projet QGIS (.qgs) qui charge le tout dans l'ordre de Chuilacarte avec un fond XYZ.
 */
export async function buildQgisBundle(site: Site): Promise<{ zip: Buffer; name: string; files: string[] }> {
  const base = slugify(site.name);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'chuilacarte-qgis-'));
  const zip = new JSZip();
  const folder = zip.folder(base)!;
  const files: string[] = [];
  try {
    // 1) GeoPackage de toutes les couches vectorielles (visibles ou non), dans la projection métrique du site
    const allVector = site.layers.filter((l) => l.kind === 'vector').map((l) => l.id);
    const layers = await collectExportLayers(site, allVector);
    const nonEmpty = layers.filter((l) => l.features.length);
    const gpkgFile = path.join(tmp, `${base}.gpkg`);
    const tables = nonEmpty.length ? buildGpkg(gpkgFile, site, nonEmpty, 'utm') : [];
    if (tables.length) {
      folder.file(`${base}.gpkg`, await fs.readFile(gpkgFile));
      files.push(`${base}.gpkg`);
    }
    const epsg = site.utm.epsg;
    const projLayers: PL[] = [];
    let n = 0;
    // QGIS exige des identifiants de couche d'au moins 11 caractères
    const mkId = (s: string) => `${slugify(s).replace(/-/g, '_').slice(0, 30)}_${Date.now().toString(36)}${(n++).toString(36).padStart(3, '0')}`;

    // 2) couches dans l'ordre de la pile Chuilacarte (index 0 = dessus)
    for (const l of site.layers) {
      if (l.kind === 'vector') {
       for (const t of tables.filter((x) => x.layerId === l.id)) {
        const qml = layerQml(t.styled, t.features as any, t.kind);
        const id = mkId(l.name);
        const ds = `./${base}.gpkg|layername=${t.table}`;
        const lname = t.suffix ? `${l.name} (${t.suffix})` : l.name;
        projLayers.push({
          id,
          name: lname,
          visible: l.visible,
          xml: `<maplayer type="vector" geometry="${QGIS_GEOM[t.geomType]}" wkbType="${WKB_TYPE[t.geomType]}" labelsEnabled="${/<labeling/.test(qml) ? 1 : 0}" autoRefreshEnabled="0" hasScaleBasedVisibilityFlag="0" readOnly="0" simplifyDrawingHints="1" simplifyLocal="1" simplifyMaxScale="1" simplifyAlgorithm="0" simplifyDrawingTol="1" styleCategories="AllStyleCategories">
<id>${id}</id>
<datasource>${esc(ds)}</datasource>
<keywordList><value></value></keywordList>
<layername>${esc(lname)}</layername>
<srs>${srsXml(epsg)}</srs>
<resourceMetadata><identifier>${esc(l.id)}</identifier><title>${esc(l.name)}</title><abstract>${esc(`${l.source.name} — ${l.source.license} — ${l.source.attribution}`)}</abstract><rights>${esc(l.source.attribution)}</rights></resourceMetadata>
<provider encoding="UTF-8">ogr</provider>
${qmlBody(qml)}
<blendMode>0</blendMode><featureBlendMode>0</featureBlendMode><layerOpacity>${l.opacity}</layerOpacity>
</maplayer>`,
        });
       }
      } else if (l.raster?.type === 'image' && l.raster.url.startsWith('files/')) {
        // image calée : PNG + world file en WGS84 (emprise) — les plans tournés passent en GeoTIFF-like via 4 coins
        const src = siteFile(site.slug, l.raster.url);
        let buf: Buffer;
        try {
          buf = await fs.readFile(src);
        } catch {
          continue;
        }
        const meta = await sharp(buf).metadata();
        const W = meta.width || 1;
        const H = meta.height || 1;
        const fname = `images/${path.basename(l.raster.url).replace(/\.[a-z]+$/i, '')}.png`;
        const png = meta.format === 'png' ? buf : await sharp(buf).png().toBuffer();
        let pgw: string;
        if (l.raster.bounds) {
          const [w, s, e, nn] = l.raster.bounds;
          const px = (e - w) / W;
          const py = (nn - s) / H;
          pgw = [px, 0, 0, -py, w + px / 2, nn - py / 2].map((v) => v.toFixed(12)).join('\n');
        } else if (l.raster.corners) {
          // affine à partir des coins HG, HD, BG
          const [tl, tr, , bl] = l.raster.corners;
          const A = (tr[0] - tl[0]) / W;
          const D = (tr[1] - tl[1]) / W;
          const B = (bl[0] - tl[0]) / H;
          const E = (bl[1] - tl[1]) / H;
          pgw = [A, D, B, E, tl[0] + A / 2 + B / 2, tl[1] + D / 2 + E / 2].map((v) => v.toFixed(12)).join('\n');
        } else continue;
        folder.file(fname, png);
        folder.file(fname.replace(/\.png$/, '.pgw'), pgw + '\n');
        folder.file(fname.replace(/\.png$/, '.png.aux.xml'), `<PAMDataset><SRS dataAxisToSRSAxisMapping="2,1">GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]</SRS></PAMDataset>\n`);
        files.push(fname);
        const id = mkId(l.name);
        projLayers.push({
          id,
          name: l.name,
          visible: l.visible,
          xml: `<maplayer type="raster" autoRefreshEnabled="0" hasScaleBasedVisibilityFlag="0" styleCategories="AllStyleCategories">
<id>${id}</id><datasource>./${esc(fname)}</datasource><layername>${esc(l.name)}</layername>
<srs>${srsXml(4326)}</srs>
<provider>gdal</provider>
<pipe><rasterrenderer type="multibandcolor" opacity="${l.opacity}" alphaBand="${meta.channels === 4 ? 4 : -1}" redBand="1" greenBand="2" blueBand="3" nodataColor=""><rasterTransparency/></rasterrenderer><brightnesscontrast brightness="0" contrast="0"/><huesaturation saturation="0" colorizeOn="0"/><rasterresampler maxOversampling="2"${l.raster.legend ? '' : ' zoomedInResampler="bilinear"'}/></pipe>
<blendMode>0</blendMode>
</maplayer>`,
        });
      } else if (l.raster?.type === 'tiles') {
        const srcId = l.raster.url.match(/\/api\/tiles\/([^/]+)\//)?.[1];
        const def = srcId ? TILE_SOURCES[srcId] : undefined;
        if (!def || def.keyEnv) continue;
        const id = mkId(l.name);
        const ds = `type=xyz&url=${encodeURIComponent(def.url)}&zmax=${def.maxzoom}&zmin=0`;
        projLayers.push({
          id,
          name: l.name,
          visible: l.visible,
          xml: `<maplayer type="raster"><id>${id}</id><datasource>${esc(ds)}</datasource><layername>${esc(l.name)}</layername><srs>${srsXml(3857)}</srs><provider>wms</provider><pipe><rasterrenderer type="singlebandcolordata" opacity="${l.opacity}" band="1" alphaBand="-1"/></pipe></maplayer>`,
        });
      }
    }

    // 3) fond de carte XYZ (QGIS charge lui-même les tuiles, en interactif)
    const bm = basemapById(site.basemap);
    const xyz = bm.xyz || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const bmName = bm.xyz ? `Fond : ${bm.label}${bm.kind === 'vector' ? ' (tuiles OSM, équivalent raster)' : ''}` : 'Fond : OpenStreetMap';
    const bmId = mkId('fond');
    projLayers.push({
      id: bmId,
      name: bmName,
      visible: true,
      xml: `<maplayer type="raster"><id>${bmId}</id><datasource>${esc(`type=xyz&url=${encodeURIComponent(xyz)}&zmax=19&zmin=0`)}</datasource><layername>${esc(bmName)}</layername><srs>${srsXml(3857)}</srs><provider>wms</provider><resourceMetadata><rights>${esc(/tile\.openstreetmap\.org/.test(xyz) ? '© les contributeurs d’OpenStreetMap' : bm.attribution || '© les contributeurs d’OpenStreetMap')}</rights></resourceMetadata><pipe><rasterrenderer type="singlebandcolordata" opacity="1" band="1" alphaBand="-1"/></pipe></maplayer>`,
    });

    // 4) projet
    const ext = projectGeometry(site.utm, bufferedEmprise(site).geometry) as any;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const v = (c: any) => (typeof c[0] === 'number' ? ((x0 = Math.min(x0, c[0])), (x1 = Math.max(x1, c[0])), (y0 = Math.min(y0, c[1])), (y1 = Math.max(y1, c[1]))) : c.forEach(v));
    v(ext.coordinates);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.05;
    const tree = projLayers
      .map((p) => `<layer-tree-layer id="${p.id}" name="${esc(p.name)}" checked="${p.visible ? 'Qt::Checked' : 'Qt::Unchecked'}" expanded="1" providerKey="${/provider>gdal/.test(p.xml) ? 'gdal' : /provider>wms/.test(p.xml) ? 'wms' : 'ogr'}" source="${p.xml.match(/<datasource>([\s\S]*?)<\/datasource>/)?.[1] || ''}"><customproperties/></layer-tree-layer>`)
      .join('\n');
    const attributions = [...new Set(site.layers.map((l) => l.source.attribution).filter(Boolean))];
    const qgs = `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis projectname="${esc(site.name)}" version="3.34.0" saveUser="chuilacarte" saveDateTime="${new Date().toISOString()}">
<homePath path=""/>
<title>${esc(site.name)}</title>
<transaction mode="Disabled"/>
<projectFlags set=""/>
<projectCrs>${srsXml(epsg)}</projectCrs>
<layer-tree-group><customproperties/>
${tree}
<custom-order enabled="0">${projLayers.map((p) => `<item>${p.id}</item>`).join('')}</custom-order>
</layer-tree-group>
<snapping-settings enabled="0" mode="2" type="1" tolerance="12" unit="1" intersection-snapping="0"/>
<relations/>
<mapcanvas name="theMapCanvas" annotationsVisible="1">
<units>meters</units>
<extent><xmin>${x0 - pad}</xmin><ymin>${y0 - pad}</ymin><xmax>${x1 + pad}</xmax><ymax>${y1 + pad}</ymax></extent>
<rotation>0</rotation>
<destinationsrs>${srsXml(epsg)}</destinationsrs>
<rendermaptile>0</rendermaptile>
</mapcanvas>
<projectlayers>
${projLayers.map((p) => p.xml).join('\n')}
</projectlayers>
<layerorder>${projLayers.map((p) => `<layer id="${p.id}"/>`).join('')}</layerorder>
<properties>
<Paths><Absolute type="bool">false</Absolute></Paths>
<Measurement><DistanceUnits type="QString">meters</DistanceUnits><AreaUnits type="QString">m2</AreaUnits></Measurement>
<SpatialRefSys><ProjectionsEnabled type="int">1</ProjectionsEnabled></SpatialRefSys>
<WMSServiceTitle type="QString">${esc(site.name)}</WMSServiceTitle>
</properties>
<projectMetadata><identifier>${esc(site.slug)}</identifier><title>${esc(site.name)}</title><abstract>${esc(`Projet exporté par Chuilacarte le ${new Date().toLocaleString('fr-FR')}. Sources : ${attributions.join(' ; ')}`)}</abstract><rights>${esc(attributions.join(' ; '))}</rights><author>Chuilacarte</author><creation>${new Date().toISOString()}</creation></projectMetadata>
</qgis>
`;
    folder.file(`${base}.qgs`, qgs);
    files.push(`${base}.qgs`);
    folder.file(
      'LISEZMOI.txt',
      `Dossier QGIS du site « ${site.name} », exporté par Chuilacarte le ${new Date().toLocaleString('fr-FR')}.

- ${base}.qgs : projet QGIS (ouvrir avec QGIS 3.22 ou plus récent). Les chemins sont relatifs : gardez les fichiers ensemble.
- ${base}.gpkg : toutes les couches vectorielles du site, en ${`WGS 84 / UTM zone ${site.utm.zone}${site.utm.south ? 'S' : 'N'}`} (EPSG:${epsg}), avec leurs styles (table layer_styles : QGIS les applique aussi si vous glissez le GeoPackage seul).
- images/ : images calées (Sentinel-2, occupation du sol, plans) en PNG + fichier de calage (.pgw) en WGS 84.
- Le fond de carte est une couche XYZ chargée par QGIS depuis Internet.

Retour vers Chuilacarte : enregistrez vos couches modifiées ou nouvelles dans un GeoPackage (ou GeoJSON / Shapefile zippé), puis, dans Chuilacarte, « Importer » ce fichier dans le site.

Sources et attributions :
${attributions.map((a) => `- ${a}`).join('\n')}
`,
    );
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return { zip: buf, name: `${base}-qgis.zip`, files };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

export type { Layer };
