// Génère les fichiers DXF de test (tests/fixtures).
import fs from 'node:fs';
import proj4 from 'proj4';
import { writeDxf } from '../lib/dxf-write';

const utm = proj4('EPSG:4326', '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs');
// 1) DXF géoréférencé en UTM 28N : îlot de la Médina
const ring = [[-17.4466, 14.6752], [-17.4452, 14.6752], [-17.4452, 14.6763], [-17.4466, 14.6763], [-17.4466, 14.6752]].map((p) => utm.forward(p));
fs.writeFileSync('tests/fixtures/ilot_utm28.dxf', writeDxf([{ layer: 'ILOT', geometry: { type: 'Polygon', coordinates: [ring] } }]));

// 2) Plan de projet en coordonnées locales (mètres) : bâtiment en L de 24 x 16 m + cour + texte
const L = [[0, 0], [24, 0], [24, 6], [8, 6], [8, 16], [0, 16], [0, 0]];
const annexe = [[12, 9], [20, 9], [20, 15], [12, 15], [12, 9]];
const parcelle = [[-4, -4], [28, -4], [28, 20], [-4, 20], [-4, -4]];
fs.writeFileSync(
  'tests/fixtures/projet_local.dxf',
  writeDxf([
    { layer: 'PARCELLE', geometry: { type: 'Polygon', coordinates: [parcelle] } },
    { layer: 'BATIMENT', geometry: { type: 'Polygon', coordinates: [L] } },
    { layer: 'BATIMENT', geometry: { type: 'Polygon', coordinates: [annexe] } },
    { layer: 'TEXTE', geometry: { type: 'Point', coordinates: [2, 2] }, text: 'Projet test', textHeight: 1.5 },
  ]),
);
console.log('ok');
