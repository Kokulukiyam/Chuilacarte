/* Test de bout en bout de Chuilacarte (Playwright, Chromium sans interface).
 *
 *   npx tsx tests/e2e/bout-en-bout.ts [url]          (défaut : http://localhost:3500)
 *
 * Variables facultatives :
 *   E2E_OUT=<dossier>     fichiers téléchargés, captures et rapport JSON (défaut /private/tmp/claude-501/chuilacarte-e2e)
 *   SERVER_LOG=<fichier>  journal du serveur à surveiller (défaut /tmp/chuilacarte-test-server-<port>.log)
 *   E2E_KEEP=1            ne pas supprimer les sites de test à la fin (débogage)
 *   E2E_HEADED=1          afficher le navigateur
 *
 * Chaque étape est indépendante autant que possible : une étape en échec est notée KO avec son erreur
 * et une capture d'écran, puis le script continue. Toutes les erreurs de la console du navigateur
 * (console.error, pageerror), les requêtes de l'application en échec ou en 5xx, et les nouvelles lignes
 * du journal du serveur sont rattachées à l'étape en cours.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page, type Download, type Locator } from 'playwright';
import * as turf from '@turf/turf';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import sharp from 'sharp';

const BASE = (process.argv[2] || 'http://localhost:3500').replace(/\/$/, '');
const PORT = new URL(BASE).port || '80';
const OUT = process.env.E2E_OUT || '/private/tmp/claude-501/chuilacarte-e2e';
const SERVER_LOG = process.env.SERVER_LOG || `/tmp/chuilacarte-test-server-${PORT}.log`;
const FIX = path.resolve(__dirname, '../fixtures');
const DL = path.join(OUT, 'telechargements');
const SHOTS = path.join(OUT, 'captures');
for (const d of [OUT, DL, SHOTS]) fs.mkdirSync(d, { recursive: true });

// ------------------------------------------------------------------ journalisation des résultats
interface Issue {
  step: string;
  kind: 'console' | 'pageerror' | 'requete' | 'serveur' | 'toast' | 'dialogue';
  text: string;
  expected?: boolean;
}
interface StepResult {
  name: string;
  ok: boolean;
  ms: number;
  notes: string[];
  error?: string;
  shot?: string;
}
const results: StepResult[] = [];
const issues: Issue[] = [];
const infos: Issue[] = [];
let currentStep = 'initialisation';
let expectErrors = false; // erreurs attendues (test négatif volontaire)
let notes: string[] = [];
const note = (s: string) => {
  notes.push(s);
  console.log(`    · ${s}`);
};

class Skip extends Error {}

function serverLogLines(): string[] {
  try {
    return fs.readFileSync(SERVER_LOG, 'utf8').split('\n');
  } catch {
    return [];
  }
}
const serverLogStart = serverLogLines().length;
let serverLogPos = serverLogStart;
function collectServerLog() {
  const lines = serverLogLines();
  const fresh = lines.slice(serverLogPos).filter((l) => l.trim());
  serverLogPos = Math.max(serverLogPos, lines.length);
  for (const l of fresh) {
    const it: Issue = { step: currentStep, kind: 'serveur', text: l.trim(), expected: expectErrors };
    if (/error|erreur|⨯|unhandled|exception|warn|fail|ECONN|EPIPE/i.test(l)) issues.push(it);
    else infos.push(it);
  }
}

let page: Page;
const dialogAnswers: (string | boolean)[] = [];
const created = new Set<string>();

async function step(name: string, fn: () => Promise<void>) {
  currentStep = name;
  notes = [];
  const t0 = Date.now();
  const nIssues = issues.length;
  console.log(`\n▶ ${name}`);
  const r: StepResult = { name, ok: true, ms: 0, notes };
  try {
    await fn();
  } catch (e: any) {
    if (e instanceof Skip) {
      r.ok = false;
      r.error = `Non exécutée : ${e.message}`;
    } else {
      r.ok = false;
      r.error = String(e?.message || e).split('\n').slice(0, 6).join('\n');
    }
    try {
      const f = path.join(SHOTS, `KO-${results.length + 1}-${slugify(name)}.png`);
      await page.screenshot({ path: f });
      r.shot = f;
    } catch {
      /* page indisponible */
    }
  }
  await sleep(300);
  collectServerLog();
  r.ms = Date.now() - t0;
  const newIssues = issues.slice(nIssues).filter((i) => !i.expected);
  console.log(`${r.ok ? '  ✔ OK' : '  ✘ KO'} (${(r.ms / 1000).toFixed(1)} s)${r.error ? ` — ${r.error}` : ''}${newIssues.length ? ` — ${newIssues.length} erreur(s) console/serveur` : ''}`);
  for (const i of newIssues.slice(0, 8)) console.log(`    ! [${i.kind}] ${i.text.slice(0, 300)}`);
  results.push(r);
  dialogAnswers.length = 0;
  expectErrors = false;
}

// ------------------------------------------------------------------ utilitaires
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);
}
function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
/** « 1 234,5 m² » → 1234.5 */
function frNum(s: string): number {
  const m = s.replace(/[   ]/g, '').match(/-?\d+(?:,\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
}
function near(a: number, b: number, tolRel: number) {
  return Math.abs(a - b) <= Math.abs(b) * tolRel;
}

async function waitFor<T>(fn: () => Promise<T>, what: string, timeout = 15000, every = 200): Promise<T> {
  const t0 = Date.now();
  let last: any;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
      last = v;
    } catch (e) {
      last = e;
    }
    if (Date.now() - t0 > timeout) throw new Error(`Délai dépassé (${Math.round(timeout / 1000)} s) : ${what}${last instanceof Error ? ` (${last.message.split('\n')[0]})` : ''}`);
    await sleep(every);
  }
}

const S = <T = any>(fn: string, arg?: any): Promise<T> => page.evaluate(({ fn, arg }) => new Function('st', 'arg', `return (${fn})(st, arg)`)((window as any).__store.getState(), arg), { fn, arg });

async function siteState() {
  return S<{ slug: string; layers: { id: string; name: string; role: string; kind: string; visible: boolean; count?: number; opacity: number; geom: string; style: any; filter?: any[]; placement?: any; project?: any; raster?: any }[]; buffer: number; emprise: any; layouts: any[] }>(
    `(st) => ({ slug: st.site.slug, buffer: st.site.buffer, emprise: st.site.emprise, layouts: st.site.layouts, layers: st.site.layers.map(l => ({ id: l.id, name: l.name, role: l.role, kind: l.kind, visible: l.visible, count: l.count, opacity: l.opacity, geom: l.geom, style: l.style, filter: l.filter, placement: l.placement, project: l.project, raster: l.raster })) })`,
  );
}
async function layerData(id: string) {
  return S<any>(`(st, id) => st.data[id]`, id);
}
async function annotationFeatures(): Promise<any[]> {
  return S(`(st) => { const l = st.site.layers.find(l => l.role === 'annotations'); return l ? (st.data[l.id]?.features || []) : []; }`);
}
async function toasts(): Promise<{ text: string; kind: string }[]> {
  return page.evaluate(() => (window as any).__toasts || []);
}
async function lastToast() {
  const t = await toasts();
  return t[t.length - 1];
}
async function clearToasts() {
  await page.evaluate(() => ((window as any).__toasts = []));
}
async function waitToast(re: RegExp, timeout = 20000) {
  return (await waitFor(async () => (await toasts()).find((t) => re.test(t.text)), `message ${re}`, timeout))!;
}

/** Attend que l'espace de travail du site soit prêt (store, carte, dessin). */
async function waitWorkspace(slug: string) {
  await waitFor(() => page.evaluate((s) => (window as any).__store?.getState().site?.slug === s && !!(window as any).__map && !!(window as any).__draw?.(), slug), `espace de travail ${slug}`, 30000);
  await waitFor(() => page.evaluate(() => (window as any).__map.isStyleLoaded()), 'style de la carte chargé', 30000);
  await page.evaluate(() => {
    const w = window as any;
    if (w.__toastSub) w.__toastSub();
    w.__toasts = w.__toasts || [];
    w.__toastSub = w.__store.subscribe((s: any, p: any) => {
      if (s.message && s.message !== p.message) w.__toasts.push({ text: s.message.text, kind: s.message.kind });
    });
  });
}
async function mapIdle(timeout = 20000) {
  await page
    .evaluate(
      (t) =>
        new Promise<void>((res) => {
          const m = (window as any).__map;
          const done = () => res();
          if (m.loaded() && !m.isMoving()) {
            setTimeout(done, 50);
            return;
          }
          m.once('idle', done);
          setTimeout(done, t);
        }),
      timeout,
    )
    .catch(() => {});
}

async function openSite(slug: string) {
  await page.goto(`${BASE}/sites/${slug}`);
  await waitWorkspace(slug);
  await mapIdle();
}
async function goHome() {
  await page.locator('a[title="Accueil"]').click();
  await page.waitForURL(`${BASE}/`);
  await page.getByTestId('new-site').waitFor();
}
async function jumpTo(lng: number, lat: number, zoom: number) {
  await page.evaluate(([lng, lat, zoom]) => (window as any).__map.jumpTo({ center: [lng, lat], zoom, bearing: 0, pitch: 0 }), [lng, lat, zoom]);
  await mapIdle();
}
async function canvasBox() {
  const b = await page.getByTestId('map').locator('canvas.maplibregl-canvas').boundingBox();
  assert(b, 'canevas de la carte introuvable');
  return b;
}
/** Position écran (px) d'un point géographique. */
async function lngLatPx(lng: number, lat: number): Promise<[number, number]> {
  const b = await canvasBox();
  const p = await page.evaluate(([lng, lat]) => (window as any).__map.project([lng, lat]), [lng, lat]);
  return [b.x + p.x, b.y + p.y];
}
/** Point géographique sous un décalage (px) par rapport au centre du canevas. */
async function pxLngLat(dx: number, dy: number): Promise<[number, number]> {
  const b = await canvasBox();
  return page.evaluate(([x, y]) => {
    const ll = (window as any).__map.unproject([x, y]);
    return [ll.lng, ll.lat];
  }, [b.width / 2 + dx, b.height / 2 + dy]);
}
async function centerPx(dx: number, dy: number): Promise<[number, number]> {
  const b = await canvasBox();
  return [b.x + b.width / 2 + dx, b.y + b.height / 2 + dy];
}
async function clickAt([x, y]: [number, number], opts: { shift?: boolean; pause?: number } = {}) {
  await page.mouse.move(x - 6, y - 4);
  await page.mouse.move(x, y, { steps: 3 });
  if (opts.shift) await page.keyboard.down('Shift');
  await page.mouse.click(x, y);
  if (opts.shift) await page.keyboard.up('Shift');
  await sleep(opts.pause ?? 250);
}
/** Trace sur la carte (offsets en px depuis le centre). fin : 'last' = recliquer le dernier point ; 'first' = cliquer le premier ; 'none'. */
async function drawPx(pts: [number, number][], finish: 'last' | 'first' | 'none') {
  const abs = await Promise.all(pts.map((p) => centerPx(p[0], p[1])));
  for (const p of abs) await clickAt(p, { pause: 350 });
  if (finish === 'last') await clickAt(abs[abs.length - 1], { pause: 500 });
  if (finish === 'first') await clickAt(abs[0], { pause: 500 });
  await sleep(300);
}
async function drawAbs(abs: [number, number][], finish: 'last' | 'first' | 'none') {
  for (const p of abs) await clickAt(p, { pause: 350 });
  if (finish === 'last') await clickAt(abs[abs.length - 1], { pause: 500 });
  if (finish === 'first') await clickAt(abs[0], { pause: 500 });
  await sleep(300);
}
async function escape() {
  await page.getByTestId('map').click({ position: { x: 5, y: 5 }, trial: true }).catch(() => {});
  await page.keyboard.press('Escape');
  await sleep(150);
}
async function rightTab(id: 'couche' | 'analyse' | 'projet' | 'site') {
  await page.getByTestId(`tab-right-${id}`).click();
  await sleep(150);
}
async function selectLayerInPanel(id: string) {
  await page.locator(`[data-testid="layer-item"][data-layer-id="${id}"]`).click();
  await sleep(150);
}
async function saved(timeout = 20000) {
  await waitFor(() => S<boolean>(`(st) => !st.dirtySite && Object.keys(st.dirtyLayers).length === 0 && st.saving !== 'saving'`), 'sauvegarde automatique terminée', timeout);
  const s = await S<string>(`(st) => st.saving`);
  assert(s !== 'error', `sauvegarde en erreur : ${await S(`(st) => st.saveError`)}`);
}
async function download(trigger: () => Promise<any>, timeout = 300000): Promise<{ file: string; name: string; size: number; buf: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout }) as Promise<Download>, trigger()]);
  const name = d.suggestedFilename();
  const file = path.join(DL, name);
  await d.saveAs(file);
  const buf = fs.readFileSync(file);
  return { file, name, size: buf.length, buf };
}
async function shot(name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${slugify(name)}.png`) });
}
async function setInput(loc: Locator, value: string) {
  await loc.fill(value);
  await loc.press('Tab').catch(() => {});
  await sleep(200);
}
async function apiSites(): Promise<{ slug: string; name: string; hasThumbnail: boolean }[]> {
  return (await fetch(`${BASE}/api/sites`)).json();
}

// ------------------------------------------------------------------ scénario
const sites: { search?: string; draw?: string; imp?: string; dup?: string } = {};
let drawEmprise: { lng: number; lat: number } | null = null;
const imported: Record<string, string[]> = {};

async function createSiteDialog(kind: 'search' | 'draw' | 'import', name: string, buffer: number) {
  await page.getByTestId('new-site').click();
  const dlg = page.getByRole('dialog', { name: 'Nouveau site' });
  await dlg.waitFor();
  await sleep(1500); // carte de l'aperçu
  const bufBtn = dlg.locator('button.chip', { hasText: buffer === 0 ? 'Aucune' : buffer >= 1000 ? `${buffer / 1000} km` : `${buffer} m` });
  if (await bufBtn.count()) await bufBtn.first().click();
  else await dlg.getByLabel('Distance du tampon (m)').fill(String(buffer));
  return dlg;
}
async function finishCreate(dlg: Locator, name: string) {
  await dlg.getByTestId('site-name').fill(name);
  const before = new Set((await apiSites()).map((s) => s.slug));
  await dlg.getByTestId('create-site').click();
  await page.waitForURL(/\/sites\/[^/]+$/, { timeout: 30000 });
  const slug = decodeURIComponent(page.url().split('/sites/')[1]);
  created.add(slug);
  assert(!before.has(slug), `slug déjà existant : ${slug}`);
  await waitWorkspace(slug);
  await mapIdle();
  return slug;
}

async function main() {
  const browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'fr-FR', acceptDownloads: true, timezoneId: 'Africa/Dakar' });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('console', (m) => {
    if (m.type() === 'error') issues.push({ step: currentStep, kind: 'console', text: `${m.text()}${m.location()?.url ? ` (${m.location().url}:${m.location().lineNumber})` : ''}`, expected: expectErrors });
    else if (m.type() === 'warning') infos.push({ step: currentStep, kind: 'console', text: `[warning] ${m.text()}` });
  });
  page.on('pageerror', (e) => issues.push({ step: currentStep, kind: 'pageerror', text: `${e.name}: ${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}`, expected: expectErrors }));
  page.on('requestfailed', (r) => {
    const u = r.url();
    const err = r.failure()?.errorText || '';
    const own = u.startsWith(BASE);
    // les annulations de tuiles par MapLibre (déplacement de la carte) sont normales
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(err)) {
      infos.push({ step: currentStep, kind: 'requete', text: `annulée : ${u.slice(0, 160)}` });
      return;
    }
    (own ? issues : infos).push({ step: currentStep, kind: 'requete', text: `${r.method()} ${u.slice(0, 200)} → ${err}${own ? '' : ' (service externe)'}`, expected: expectErrors });
  });
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 500 && u.startsWith(BASE)) issues.push({ step: currentStep, kind: 'requete', text: `${r.request().method()} ${u.slice(0, 200)} → HTTP ${r.status()}`, expected: expectErrors });
    else if (r.status() >= 400 && u.startsWith(BASE)) infos.push({ step: currentStep, kind: 'requete', text: `${r.request().method()} ${u.slice(0, 200)} → HTTP ${r.status()}` });
  });
  // boîtes de dialogue de l'application (data-testid="dialog") : réponse prise dans dialogAnswers, comme pour les dialogues natifs
  let answering = false;
  setInterval(async () => {
    if (answering || page.isClosed()) return;
    answering = true;
    try {
      const dlg = page.getByTestId('dialog');
      if (await dlg.count()) {
        const a = dialogAnswers.shift();
        infos.push({ step: currentStep, kind: 'dialogue', text: `« ${await dlg.getAttribute('aria-label')} » → ${a === undefined ? '(défaut)' : String(a)}` });
        if (a === false) await dlg.getByTestId('dialog-cancel').click({ timeout: 2000 });
        else {
          if (typeof a === 'string') await dlg.getByTestId('dialog-input').fill(a, { timeout: 2000 });
          await dlg.getByTestId('dialog-ok').click({ timeout: 2000 });
        }
      }
    } catch {
      /* dialogue déjà fermé */
    } finally {
      answering = false;
    }
  }, 150).unref();
  page.on('dialog', async (d) => {
    const a = dialogAnswers.shift();
    infos.push({ step: currentStep, kind: 'dialogue', text: `${d.type()} « ${d.message()} » → ${a === undefined ? '(défaut)' : String(a)}` });
    try {
      if (d.type() === 'alert') {
        issues.push({ step: currentStep, kind: 'dialogue', text: `alert() inattendue : ${d.message()}`, expected: expectErrors });
        await d.accept();
      } else if (d.type() === 'confirm') {
        if (a === false) await d.dismiss();
        else await d.accept();
      } else if (d.type() === 'prompt') {
        if (a === false) await d.dismiss();
        else await d.accept(typeof a === 'string' ? a : d.defaultValue());
      } else await d.accept();
    } catch {
      /* déjà fermé */
    }
  });

  // ================================================================ 1. sites
  await step('1.1 Accueil et création d’un site par recherche (« Médina, Dakar »)', async () => {
    await page.goto(BASE);
    await page.getByTestId('new-site').waitFor();
    const dlg = await createSiteDialog('search', '', 250);
    await dlg.getByTestId('geocode-input').fill('Médina, Dakar');
    await dlg.getByTestId('geocode-input').press('Enter');
    const res = dlg.getByTestId('geocode-result');
    await res.first().waitFor({ timeout: 30000 });
    note(`${await res.count()} résultat(s) ; premier : ${(await res.first().innerText()).replace(/\n/g, ' — ')}`);
    await res.first().click();
    await dlg.getByText(/Surface de l’emprise/).waitFor();
    note((await dlg.getByText(/Surface de l’emprise/).innerText()).trim());
    sites.search = await finishCreate(dlg, 'E2E Recherche Médina');
    const s = await siteState();
    note(`site créé : ${s.slug}, tampon ${s.buffer} m, couches : ${s.layers.map((l) => l.name).join(', ')}`);
    assert(s.buffer === 250, `tampon attendu 250 m, obtenu ${s.buffer}`);
    const bb = turf.bbox(s.emprise);
    assert(bb[0] > -17.47 && bb[2] < -17.43 && bb[1] > 14.66 && bb[3] < 14.70, `emprise hors de la Médina : ${bb.map((x) => x.toFixed(4))}`);
    assert(s.layers.some((l) => l.id === 'tampon'), 'couche zone tampon absente');
  });

  await step('1.2 Création d’un site par dessin d’emprise (rectangle d’environ 250 m dans la Médina)', async () => {
    await goHome();
    const dlg = await createSiteDialog('draw', '', 100);
    // on centre d'abord l'aperçu sur la Médina par la recherche, puis on dessine
    await dlg.getByTestId('geocode-input').fill('Médina, Dakar');
    await dlg.getByTestId('geocode-input').press('Enter');
    await dlg.getByTestId('geocode-result').first().click({ timeout: 30000 });
    await sleep(1500);
    await dlg.getByTestId('tab-draw').click();
    await dlg.getByTestId('draw-rect').click();
    const mapBox = await dlg.locator('.maplibregl-canvas').boundingBox();
    assert(mapBox, 'carte de l’aperçu introuvable');
    const cx = mapBox.x + mapBox.width / 2;
    const cy = mapBox.y + mapBox.height / 2;
    await clickAt([cx - 30, cy - 25], { pause: 400 });
    await page.mouse.move(cx + 30, cy + 25, { steps: 8 });
    await clickAt([cx + 30, cy + 25], { pause: 800 });
    const surf = await dlg.getByText(/Surface de l’emprise/).innerText();
    note(`rectangle dessiné — ${surf.trim()}`);
    sites.draw = await finishCreate(dlg, 'E2E Dessin îlot Médina');
    const s = await siteState();
    const bb = turf.bbox(s.emprise);
    const w = turf.distance([bb[0], bb[1]], [bb[2], bb[1]], { units: 'meters' });
    const h = turf.distance([bb[0], bb[1]], [bb[0], bb[3]], { units: 'meters' });
    drawEmprise = { lng: (bb[0] + bb[2]) / 2, lat: (bb[1] + bb[3]) / 2 };
    note(`emprise ${w.toFixed(0)} × ${h.toFixed(0)} m centrée sur ${drawEmprise.lat.toFixed(5)}, ${drawEmprise.lng.toFixed(5)} ; tampon ${s.buffer} m`);
    assert(w > 80 && w < 800 && h > 80 && h < 800, `taille d’emprise inattendue ${w.toFixed(0)} × ${h.toFixed(0)} m`);
    assert(bb[0] > -17.47 && bb[2] < -17.43, 'emprise hors de la Médina');
  });

  await step('1.3 Création d’un site par import de fichier (zone.geojson, objets gardés comme couche)', async () => {
    await goHome();
    const dlg = await createSiteDialog('import', '', 100);
    await dlg.getByTestId('tab-import').click();
    await dlg.getByTestId('import-file').setInputFiles(path.join(FIX, 'zone.geojson'));
    await dlg.getByText(/objet\(s\)/).waitFor({ timeout: 20000 });
    note(`fichier lu : ${(await dlg.getByText(/objet\(s\)/).innerText()).trim()}`);
    assert(await dlg.getByText('Ajouter aussi ces objets comme couche').isVisible(), 'case « Ajouter aussi ces objets comme couche » absente');
    sites.imp = await finishCreate(dlg, 'E2E Import zone');
    const s = await siteState();
    const imp = s.layers.filter((l) => l.role === 'imported');
    note(`couches : ${s.layers.map((l) => `${l.name} (${l.count ?? '-'})`).join(', ')}`);
    assert(imp.length === 1 && imp[0].count === 1, 'la couche importée avec l’emprise est absente ou vide');
  });

  await step('1.4 Zone tampon modifiée dans l’onglet Site (100 → 300 m)', async () => {
    if (!sites.imp) throw new Skip('site importé absent');
    await rightTab('site');
    const before = turf.area(await layerData('tampon'));
    await page.getByTestId('buffer-input').fill('300');
    await page.getByTestId('site-panel').getByRole('button', { name: 'Appliquer' }).click();
    await waitFor(async () => turf.area(await layerData('tampon')) > before * 1.3, 'zone tampon régénérée', 15000);
    const after = turf.area(await layerData('tampon'));
    note(`surface emprise + tampon : ${(before / 1e4).toFixed(2)} ha → ${(after / 1e4).toFixed(2)} ha`);
    const s = await siteState();
    const tl = s.layers.find((l) => l.id === 'tampon')!;
    note(`nom de la couche tampon dans l’interface : « ${tl.name} »`);
    await saved();
    await page.reload();
    await waitWorkspace(sites.imp);
    const s2 = await siteState();
    const tl2 = s2.layers.find((l) => l.id === 'tampon')!;
    note(`après rechargement : tampon ${s2.buffer} m, couche « ${tl2.name} »`);
    assert(s2.buffer === 300, 'tampon non conservé après rechargement');
    assert(/300/.test(tl2.name), `le nom de la couche tampon n’a pas suivi la nouvelle distance : « ${tl2.name} »`);
  });

  await step('1.5 Écran d’accueil : vignette, renommer, dupliquer, supprimer', async () => {
    await goHome();
    await sleep(1500);
    await page.reload();
    const cards = page.getByTestId('site-card');
    await cards.first().waitFor();
    const list = await apiSites();
    const mine = list.filter((s) => created.has(s.slug));
    note(`${await cards.count()} carte(s) à l’accueil ; vignettes : ${mine.map((s) => `${s.slug}=${s.hasThumbnail ? 'oui' : 'non'}`).join(', ')}`);
    const withThumb = mine.filter((s) => s.hasThumbnail);
    assert(withThumb.length >= 1, 'aucune vignette enregistrée pour les sites visités');
    const r = await fetch(`${BASE}/api/sites/${withThumb[0].slug}/thumbnail`);
    const b = Buffer.from(await r.arrayBuffer());
    assert(b.subarray(0, 4).toString('hex') === '89504e47', 'la vignette n’est pas un PNG');
    const st = await sharp(b).stats();
    note(`vignette ${withThumb[0].slug} : ${b.length} octets, écart-type moyen des canaux ${st.channels.slice(0, 3).map((c) => c.stdev.toFixed(1)).join('/')}`);
    assert(st.channels.some((c) => c.stdev > 3), 'vignette uniforme (carte vide ?)');
    // renommer
    const card = cards.filter({ hasText: 'E2E Import zone' });
    dialogAnswers.push('E2E Import renommé');
    await card.getByRole('button', { name: 'Renommer' }).click();
    await page.getByTestId('site-card').filter({ hasText: 'E2E Import renommé' }).waitFor();
    // dupliquer
    const before = new Set((await apiSites()).map((s) => s.slug));
    await page.getByTestId('site-card').filter({ hasText: 'E2E Import renommé' }).getByRole('button', { name: 'Dupliquer' }).click();
    const dup = (await waitFor(async () => (await apiSites()).find((s) => !before.has(s.slug)), 'site dupliqué', 15000))!;
    created.add(dup.slug);
    sites.dup = dup.slug;
    note(`copie créée : ${dup.slug} « ${dup.name} »`);
    await page.getByTestId('site-card').filter({ hasText: dup.name }).first().waitFor();
    const dupSite = await (await fetch(`${BASE}/api/sites/${dup.slug}`)).json();
    note(`copie : ${dupSite.layers.length} couches, tampon ${dupSite.buffer} m`);
    assert(dupSite.layers.length >= 3, 'la copie n’a pas ses couches');
    // supprimer (la copie)
    dialogAnswers.push(true);
    await page.getByTestId('site-card').filter({ hasText: dup.name }).first().getByRole('button', { name: 'Supprimer' }).click();
    await waitFor(async () => !(await apiSites()).some((s) => s.slug === dup.slug), 'suppression de la copie', 10000);
    assert(!fs.existsSync(path.resolve(__dirname, '../../data/sites', dup.slug)), 'dossier de la copie toujours présent');
    created.delete(dup.slug);
    note('copie supprimée par l’interface (dossier effacé)');
  });

  // ================================================================ 2. collecte
  await step('2. Collecte des données sur l’îlot (toutes les sources) et résumé', async () => {
    if (!sites.draw) throw new Skip('site dessiné absent');
    await openSite(sites.draw);
    const n0 = (await siteState()).layers.length;
    await page.getByTestId('collect-open').click();
    const dlg = page.getByRole('dialog', { name: 'Collecter les données' });
    await dlg.getByTestId('collector-osm').waitFor();
    const boxes = dlg.locator('input[type=checkbox][data-testid^="collector-"]');
    const nb = await boxes.count();
    for (let i = 0; i < nb; i++) if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
    note(`${nb} sources cochées`);
    const t0 = Date.now();
    await dlg.getByTestId('collect-run').click();
    await waitFor(async () => !/en cours/.test(await dlg.getByTestId('collect-run').innerText()), 'fin de la collecte', 20 * 60000, 2000);
    note(`durée de la collecte : ${Math.round((Date.now() - t0) / 1000)} s`);
    const summary = await dlg.getByTestId('collect-summary').innerText().catch(() => '(pas de résumé)');
    fs.writeFileSync(path.join(OUT, 'resume-collecte.txt'), summary);
    const report = await S<any>(`(st) => st.site.reports[st.site.reports.length - 1]`);
    assert(report, 'pas de rapport de collecte enregistré dans le site');
    for (const it of report.items) note(`${it.ok ? '✓' : '✗'} ${it.source}${it.layer ? ` — ${it.layer}` : ''}${it.ok ? ` : ${it.count ?? ''}` : ` : ÉCHEC ${it.error}`}`);
    const s = await siteState();
    note(`${s.layers.length - n0} couches ajoutées (${s.layers.length} au total)`);
    const failed = report.items.filter((i: any) => !i.ok);
    const t = await lastToast();
    if (t) note(`message : ${t.text}`);
    await dlg.getByRole('button', { name: 'Fermer' }).last().click();
    assert(s.layers.length > n0 + 5, 'trop peu de couches collectées');
    assert(failed.length === 0, `${failed.length} source(s) en échec : ${failed.map((f: any) => `${f.source} (${f.error})`).join(' ; ')}`);
  });

  // ================================================================ 3. couches
  await step('3.1 Import de chaque fixture comme couche', async () => {
    if (!sites.draw) throw new Skip('site dessiné absent');
    const files = ['zone.geojson', 'repere.kml', 'parcelle_utm.gpkg', 'parcelle_shp.zip', 'points.csv', 'ilot_utm28.dxf'];
    const problems: string[] = [];
    for (const f of files) {
      await clearToasts();
      const ids0 = new Set((await siteState()).layers.map((l) => l.id));
      await page.getByTestId('import-layer-input').setInputFiles(path.join(FIX, f));
      const t = await waitToast(/importée|Erreur|erreur|impossible|Aucun/i, 30000).catch(() => null);
      const s = await siteState();
      const nl = s.layers.filter((l) => !ids0.has(l.id));
      imported[f] = nl.map((l) => l.id);
      if (!nl.length) {
        problems.push(`${f} : aucune couche (${t?.text || 'pas de message'})`);
        note(`✗ ${f} : ${t?.text || 'pas de message'}`);
        continue;
      }
      for (const l of nl) {
        const fc = await layerData(l.id);
        const bb = turf.bbox(fc);
        const okPos = bb[0] > -17.6 && bb[2] < -17.3 && bb[1] > 14.6 && bb[3] < 14.8;
        note(`${okPos ? '✓' : '✗'} ${f} → « ${l.name} » ${l.geom}, ${fc.features.length} objet(s), bbox ${bb.map((x: number) => x.toFixed(4)).join(', ')}`);
        if (!okPos) problems.push(`${f} : position hors de Dakar (${bb.map((x: number) => x.toFixed(3))})`);
        if (!fc.features.length) problems.push(`${f} : couche vide`);
      }
    }
    // projet_local.dxf (coordonnées locales) par l'import général : doit être refusé proprement
    expectErrors = true;
    await clearToasts();
    const ids0 = new Set((await siteState()).layers.map((l) => l.id));
    await page.getByTestId('import-layer-input').setInputFiles(path.join(FIX, 'projet_local.dxf'));
    const t = await waitToast(/./, 20000).catch(() => null);
    const nl = (await siteState()).layers.filter((l) => !ids0.has(l.id));
    note(`projet_local.dxf par « Importer » : ${nl.length ? `${nl.length} couche(s) créée(s)` : 'refusé'} — message : ${t?.text || '(aucun)'} [${t?.kind}]`);
    expectErrors = false;
    assert(!problems.length, problems.join(' ; '));
  });

  await step('3.2 Afficher/masquer, ordre (glisser-déposer), opacité, renommer', async () => {
    if (!sites.draw) throw new Skip('site dessiné absent');
    await rightTab('couche');
    const s = await siteState();
    const target = s.layers.find((l) => l.kind === 'vector' && l.count && l.role === 'imported' && l.geom === 'polygon') || s.layers.find((l) => l.kind === 'vector' && l.count)!;
    const item = page.locator(`[data-testid="layer-item"][data-layer-id="${target.id}"]`);
    // visibilité
    await item.getByTestId('layer-visibility').click();
    await sleep(300);
    const vis = await page.evaluate((id) => {
      const m = (window as any).__map;
      return m.getStyle().layers.filter((l: any) => l.id.startsWith(`lyr-${id}-`)).map((l: any) => m.getLayoutProperty(l.id, 'visibility') || 'visible');
    }, target.id);
    note(`« ${target.name} » masquée : visibilité MapLibre = ${[...new Set(vis)].join('/') || '(couches retirées)'}`);
    assert((await siteState()).layers.find((l) => l.id === target.id)!.visible === false, 'couche non masquée');
    assert(vis.every((v: string) => v === 'none'), 'la couche reste visible sur la carte');
    await item.getByTestId('layer-visibility').click();
    await sleep(200);
    assert((await siteState()).layers.find((l) => l.id === target.id)!.visible === true, 'couche non réaffichée');
    // ordre par glisser-déposer : la 1re couche va en 3e position
    const order0 = (await siteState()).layers.map((l) => l.id);
    const items = page.getByTestId('layer-item');
    await items.nth(0).dragTo(items.nth(2));
    await sleep(400);
    const order1 = (await siteState()).layers.map((l) => l.id);
    note(`ordre : ${order0.slice(0, 3).join(', ')} → ${order1.slice(0, 3).join(', ')}`);
    assert(order1[2] === order0[0] && order1[0] === order0[1], 'le glisser-déposer n’a pas réordonné les couches');
    const mapOrder = await page.evaluate((ids) => {
      const ls = (window as any).__map.getStyle().layers.map((l: any) => l.id);
      return ids.map((id: string) => ls.findIndex((x: string) => x.startsWith(`lyr-${id}-`)));
    }, order1.slice(0, 3));
    note(`indices MapLibre des 3 premières couches : ${mapOrder.join(', ')} (doivent décroître)`);
    // opacité et nom
    await selectLayerInPanel(target.id);
    await page.getByTestId('layer-opacity').fill('0.5');
    await sleep(200);
    assert((await siteState()).layers.find((l) => l.id === target.id)!.opacity === 0.5, 'opacité non appliquée');
    await setInput(page.getByTestId('layer-name'), 'Îlot test renommé');
    assert((await siteState()).layers.find((l) => l.id === target.id)!.name === 'Îlot test renommé', 'renommage non appliqué');
    note('opacité 50 % et renommage « Îlot test renommé » appliqués');
  });

  let styleLayer = '';
  await step('3.3 Filtre attributaire', async () => {
    if (!sites.draw) throw new Skip('site dessiné absent');
    const s = await siteState();
    // couche de bâti collectée avec un attribut numérique
    const cands = s.layers.filter((l) => l.kind === 'vector' && l.role === 'buildings' && (l.count || 0) > 5);
    assert(cands.length, 'aucune couche de bâti collectée');
    styleLayer = cands.sort((a, b) => (b.count || 0) - (a.count || 0))[0].id;
    const fc = await layerData(styleLayer);
    const nums: Record<string, number[]> = {};
    for (const f of fc.features) for (const [k, v] of Object.entries(f.properties || {})) if (!k.startsWith('_') && typeof v === 'number') (nums[k] ||= []).push(v);
    const field = Object.keys(nums).find((k) => new Set(nums[k]).size > 3);
    assert(field, 'pas d’attribut numérique pour filtrer');
    const vals = nums[field].sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)];
    const expected = fc.features.filter((f: any) => Number(f.properties?.[field]) > med).length;
    await selectLayerInPanel(styleLayer);
    await page.getByTestId('filter-add').click();
    await page.getByTestId('filter-field').selectOption(field);
    await page.getByTestId('filter-op').selectOption('>');
    await page.getByTestId('filter-value').fill(String(med));
    await sleep(500);
    const txt = await page.getByTestId('filter-editor').innerText();
    const m = txt.match(/(\d+)\s*\/\s*(\d+) objets affichés/);
    note(`« ${s.layers.find((l) => l.id === styleLayer)!.name} » : ${field} > ${med} → ${m ? m[0] : txt.replace(/\n/g, ' ')} (attendu ${expected})`);
    assert(m && Number(m[1]) === expected, 'nombre d’objets filtrés incorrect');
    const mf = await page.evaluate((id) => {
      const m = (window as any).__map;
      const l = m.getStyle().layers.find((x: any) => x.id.startsWith(`lyr-${id}-`));
      return l ? JSON.stringify(m.getFilter(l.id)) : null;
    }, styleLayer);
    note(`filtre MapLibre : ${String(mf).slice(0, 120)}`);
    assert(mf && mf.includes(field), 'le filtre n’est pas appliqué à la carte');
    // on retire la condition
    await page.getByLabel('Supprimer la condition').click();
    await sleep(200);
  });

  await step('3.4 Styles : simple, catégorisé, gradué, hachures, étiquettes, bibliothèque', async () => {
    if (!styleLayer) throw new Skip('pas de couche de bâti');
    await selectLayerInPanel(styleLayer);
    const paint = (prop: string) =>
      page.evaluate(
        ([id, prop]) => {
          const m = (window as any).__map;
          return JSON.stringify(m.getPaintProperty(`lyr-${id}-fill`, prop));
        },
        [styleLayer, prop],
      );
    // simple
    await page.getByTestId('style-mode-simple').click();
    await page.getByTestId('style-fill').fill('#ff0000');
    await sleep(300);
    const fill = await paint('fill-color');
    note(`simple : fill-color = ${fill}`);
    assert(/ff0000|255,0,0/i.test(fill), 'couleur de remplissage non appliquée');
    // catégorisé
    await page.getByTestId('style-mode-categorized').click();
    const catOpts = await page.getByTestId('cat-field').locator('option').allInnerTexts();
    const catField = await page.getByTestId('cat-field').locator('option').nth(1).getAttribute('value');
    assert(catField, `aucun attribut proposé pour le catégorisé (${catOpts.join(', ')})`);
    await page.getByTestId('cat-field').selectOption(catField);
    await sleep(400);
    const cls = (await siteState()).layers.find((l) => l.id === styleLayer)!.style.categorized;
    const fc2 = await paint('fill-color');
    note(`catégorisé sur « ${catField} » : ${cls?.classes.length} classes ; fill-color = ${fc2.slice(0, 80)}…`);
    assert(cls?.classes.length && /match|case/.test(fc2), 'catégories non appliquées à la carte');
    // gradué
    await page.getByTestId('style-mode-graduated').click();
    const gopts = await page.getByTestId('grad-field').locator('option').count();
    assert(gopts > 1, 'aucun attribut numérique proposé pour le gradué');
    const gField = await page.getByTestId('grad-field').locator('option').nth(1).getAttribute('value');
    await page.getByTestId('grad-field').selectOption(gField!);
    await sleep(400);
    const gr = (await siteState()).layers.find((l) => l.id === styleLayer)!.style.graduated;
    const fc3 = await paint('fill-color');
    note(`gradué sur « ${gField} » : ${gr?.classes.length} classes (${gr?.classes.map((c: any) => `${c.min}–${c.max}`).join(' | ')})`);
    assert(gr?.classes.length >= 2 && /step|interpolate|case/.test(fc3), 'classes graduées non appliquées');
    // hachures
    await page.getByTestId('style-hatch').selectOption('diag');
    await sleep(500);
    const hatch = await page.evaluate((id) => !!(window as any).__map.getLayer(`lyr-${id}-hatch`), styleLayer);
    note(`hachures diagonales : couche MapLibre de hachures ${hatch ? 'présente' : 'absente'}`);
    assert(hatch, 'hachures non affichées');
    // étiquettes
    const lf = await page.getByTestId('style-label-field').locator('option').nth(1).getAttribute('value');
    await page.getByTestId('style-label-field').selectOption(lf!);
    await sleep(400);
    const lab = await page.evaluate((id) => {
      const m = (window as any).__map;
      return m.getLayer(`lyr-${id}-label`) ? JSON.stringify(m.getLayoutProperty(`lyr-${id}-label`, 'text-field')) : null;
    }, styleLayer);
    note(`étiquettes sur « ${lf} » : text-field = ${lab}`);
    assert(lab, 'couche d’étiquettes absente');
    // bibliothèque
    const presets = await page.getByTestId('style-preset').locator('option').allInnerTexts();
    const pv = await page.getByTestId('style-preset').locator('option').nth(1).getAttribute('value');
    await page.getByTestId('style-preset').selectOption(pv!);
    await sleep(300);
    const st = (await siteState()).layers.find((l) => l.id === styleLayer)!.style;
    note(`bibliothèque : ${presets.length - 1} styles proposés (${presets.slice(1, 6).join(', ')}…) ; « ${presets[1]} » appliqué (mode ${st.mode}, remplissage ${st.fill})`);
    assert(st.mode === 'simple' && st.hatch === 'none', 'style de la bibliothèque non appliqué');
    // hachures et étiquettes remises pour la mise en page
    await page.getByTestId('style-hatch').selectOption('cross');
    await shot('3.4-styles');
  });

  await step('3.5 Table attributaire : tri et modification d’une cellule', async () => {
    const lid = imported['points.csv']?.[0];
    if (!lid) throw new Skip('couche points.csv absente');
    const item = page.locator(`[data-testid="layer-item"][data-layer-id="${lid}"]`);
    await item.hover();
    await item.getByTitle('Table attributaire').click();
    const table = page.getByTestId('attribute-table');
    await table.waitFor();
    const header = table.locator('th', { hasText: 'nom' }).first();
    await header.click();
    await sleep(200);
    const col = async () => table.locator('tbody tr').evaluateAll((rows) => rows.map((r) => (r.querySelectorAll('td input')[0] as HTMLInputElement)?.value));
    const asc = await col();
    await header.click();
    await sleep(200);
    const desc = await col();
    note(`tri sur « nom » : ${asc.join(' | ')} ⇄ ${desc.join(' | ')}`);
    const sorted = [...asc].sort((a, b) => a.localeCompare(b, 'fr'));
    assert(JSON.stringify(asc) === JSON.stringify(sorted) && JSON.stringify(desc) === JSON.stringify([...sorted].reverse()), 'tri incorrect');
    const cell = table.locator('tbody tr').first().locator('td input').first();
    await cell.fill('Nom modifié E2E');
    await cell.press('Enter');
    await sleep(300);
    const fc = await layerData(lid);
    assert(fc.features.some((f: any) => f.properties.nom === 'Nom modifié E2E'), 'cellule non enregistrée dans les données');
    note('cellule « nom » modifiée et enregistrée dans la couche');
    await table.getByLabel('Fermer la table').click();
  });

  let editLayer = '';
  await step('3.6 Édition de géométrie : sélection, déplacement à la souris, découpe, fusion', async () => {
    editLayer = imported['zone.geojson']?.[0];
    if (!editLayer) throw new Skip('couche zone.geojson absente');
    await rightTab('couche');
    const fc0 = await layerData(editLayer);
    const f0 = fc0.features[0];
    const c0 = turf.centroid(f0).geometry.coordinates;
    const area0 = turf.area(f0);
    await jumpTo(c0[0], c0[1], 17);
    await page.keyboard.press('v');
    // sélection par clic
    await clickAt(await lngLatPx(c0[0], c0[1]));
    let sel = await S<any>(`(st) => st.selection`);
    note(`clic sur l’îlot : sélection = ${JSON.stringify(sel)}`);
    if (!sel || sel.layerId !== editLayer) {
      // une autre couche (bâti) peut être au-dessus : on la masque
      const s = await siteState();
      const above = s.layers.slice(0, s.layers.findIndex((l) => l.id === editLayer)).filter((l) => l.visible && l.kind === 'vector');
      for (const l of above) await S(`(st, id) => { st.commit(d => { d.site.layers.find(x => x.id === id).visible = false; }); }`, l.id);
      note(`couches au-dessus masquées : ${above.map((l) => l.name).join(', ')}`);
      await sleep(300);
      await clickAt(await lngLatPx(c0[0], c0[1]));
      sel = await S<any>(`(st) => st.selection`);
    }
    assert(sel && sel.layerId === editLayer, 'impossible de sélectionner l’objet par un clic');
    // déplacement 1 m vers le nord (bouton)
    await page.getByTestId('edit-section').getByRole('button', { name: '↑' }).click();
    await sleep(200);
    const c1 = turf.centroid((await layerData(editLayer)).features[0]).geometry.coordinates;
    const d1 = turf.distance(c0, c1, { units: 'meters' });
    note(`bouton ↑ : déplacement de ${d1.toFixed(2)} m`);
    assert(Math.abs(d1 - 1) < 0.05, 'déplacement au mètre incorrect');
    // déplacement à la souris (Modifier / déplacer)
    await page.getByTestId('edit-vertices').click();
    await sleep(500);
    const p = await lngLatPx(c1[0], c1[1]);
    await page.mouse.move(p[0], p[1], { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(p[0] + 40, p[1] + 30, { steps: 12 });
    await page.mouse.up();
    await sleep(800);
    await page.getByTestId('edit-done').click();
    await sleep(400);
    const fc2 = await layerData(editLayer);
    const c2 = turf.centroid(fc2.features[0]).geometry.coordinates;
    const d2 = turf.distance(c1, c2, { units: 'meters' });
    note(`glisser de 50 px : déplacement de ${d2.toFixed(1)} m ; surface ${area0.toFixed(0)} → ${turf.area(fc2.features[0]).toFixed(0)} m²`);
    assert(d2 > 5, 'le glisser n’a pas déplacé l’objet');
    assert(near(turf.area(fc2.features[0]), area0, 0.01), 'la forme a été déformée par le déplacement');
    // découpe
    const cs = turf.centroid(fc2.features[0]).geometry.coordinates;
    await jumpTo(cs[0], cs[1], 17);
    await clickAt(await lngLatPx(cs[0], cs[1]));
    await page.getByTestId('edit-split').click();
    await sleep(300);
    const bb = turf.bbox(fc2.features[0]);
    const a = await lngLatPx(bb[0] - 0.0004, cs[1]);
    const b = await lngLatPx(bb[2] + 0.0004, cs[1] + 0.0001);
    await drawAbs([a, b], 'last');
    await sleep(500);
    const fc3 = await layerData(editLayer);
    note(`découpe : ${fc2.features.length} → ${fc3.features.length} objets ; ${(await lastToast())?.text}`);
    assert(fc3.features.length === fc2.features.length + 1, 'la découpe n’a pas produit deux parties');
    const sumA = fc3.features.reduce((s: number, f: any) => s + turf.area(f), 0);
    assert(near(sumA, area0, 0.01), `surfaces des parties incohérentes (${sumA.toFixed(0)} vs ${area0.toFixed(0)})`);
    // fusion (les deux parties restent sélectionnées) ; on teste aussi Maj + clic
    await page.keyboard.press('Escape');
    const parts = fc3.features.map((f: any) => turf.pointOnFeature(f).geometry.coordinates);
    await clickAt(await lngLatPx(parts[0][0], parts[0][1]));
    await clickAt(await lngLatPx(parts[1][0], parts[1][1]), { shift: true });
    sel = await S<any>(`(st) => st.selection`);
    note(`Maj + clic : ${sel?.fids?.length || (sel ? 1 : 0)} objet(s) sélectionné(s)`);
    const shiftOk = sel?.fids?.length === 2;
    if (!shiftOk) {
      // contournement pour tester quand même la fusion : sélection multiple posée dans le store
      await S(`(st, a) => st.select({ layerId: a[0], fid: a[1][0], fids: a[1] })`, [editLayer, fc3.features.map((f: any) => f.properties._fid)]);
      note('Maj + clic inopérant : sélection multiple posée par window.__store pour tester la fusion');
      await sleep(200);
    }
    await page.getByTestId('edit-merge').click();
    await sleep(400);
    const fc4 = await layerData(editLayer);
    note(`fusion : ${fc3.features.length} → ${fc4.features.length} objet(s), surface ${turf.area(fc4.features[0]).toFixed(0)} m² (${fc4.features[0].geometry.type})`);
    assert(fc4.features.length === 1 && near(turf.area(fc4.features[0]), area0, 0.01) && fc4.features[0].geometry.type === 'Polygon', 'fusion incorrecte');
    assert(shiftOk, 'Maj + clic ne sélectionne pas un deuxième objet (la fusion n’est pas accessible par l’interface)');
  });

  await step('3.7 Annuler / rétablir (boutons et Ctrl+Z / Ctrl+Maj+Z)', async () => {
    if (!editLayer) throw new Skip('pas de couche éditée');
    const n = async () => (await layerData(editLayer)).features.length;
    const n0 = await n();
    await page.getByTestId('undo').click();
    await sleep(200);
    const n1 = await n();
    await page.getByTestId('redo').click();
    await sleep(200);
    const n2 = await n();
    await page.locator('body').click({ position: { x: 900, y: 25 } }).catch(() => {});
    await page.keyboard.press('Control+z');
    await sleep(200);
    const n3 = await n();
    await page.keyboard.press('Control+Shift+z');
    await sleep(200);
    const n4 = await n();
    await page.keyboard.press('Meta+z');
    await sleep(200);
    const n5 = await n();
    await page.keyboard.press('Meta+Shift+z');
    await sleep(200);
    const n6 = await n();
    note(`objets : ${n0} → annuler ${n1} → rétablir ${n2} → Ctrl+Z ${n3} → Ctrl+Maj+Z ${n4} → Cmd+Z ${n5} → Cmd+Maj+Z ${n6}`);
    assert(n1 !== n0 && n2 === n0 && n3 === n1 && n4 === n0 && n5 === n1 && n6 === n0, 'annuler/rétablir incohérent');
  });

  await step('3.8 Sauvegarde automatique : rechargement de la page', async () => {
    if (!sites.draw) throw new Skip('site dessiné absent');
    await waitFor(async () => (await page.getByTestId('saved').count()) > 0, 'indicateur « Enregistré »', 15000);
    await saved();
    const before = await siteState();
    const dEdit = editLayer ? await layerData(editLayer) : null;
    await page.reload();
    await waitWorkspace(sites.draw);
    const after = await siteState();
    const diffs: string[] = [];
    if (after.layers.length !== before.layers.length) diffs.push(`nombre de couches ${before.layers.length} → ${after.layers.length}`);
    for (const l of before.layers) {
      const x = after.layers.find((y) => y.id === l.id);
      if (!x) {
        diffs.push(`couche perdue ${l.name}`);
        continue;
      }
      if (x.name !== l.name || x.opacity !== l.opacity || x.visible !== l.visible || JSON.stringify(x.style) !== JSON.stringify(l.style)) diffs.push(`couche ${l.name} modifiée`);
    }
    if (JSON.stringify(after.layers.map((l) => l.id)) !== JSON.stringify(before.layers.map((l) => l.id))) diffs.push('ordre des couches différent');
    if (dEdit) {
      const d2 = await layerData(editLayer);
      if (JSON.stringify(d2.features.map((f: any) => f.geometry)) !== JSON.stringify(dEdit.features.map((f: any) => f.geometry))) diffs.push('géométries éditées différentes');
    }
    note(diffs.length ? `différences : ${diffs.join(' ; ')}` : `${after.layers.length} couches, styles, ordre et géométries identiques après rechargement`);
    assert(!diffs.length, diffs.join(' ; '));
  });

  await step('3.9 Mode sombre', async () => {
    await page.getByRole('button', { name: 'Mode sombre' }).click();
    await sleep(800);
    const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="layers-panel"]')!).backgroundColor);
    await shot('3.9-mode-sombre');
    note(`classe dark : ${dark} ; fond du panneau des couches : ${bg}`);
    await page.reload();
    await waitWorkspace(sites.draw!);
    const kept = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    note(`mode sombre conservé après rechargement : ${kept}`);
    await page.getByRole('button', { name: 'Mode sombre' }).click();
    await sleep(300);
    assert(dark, 'mode sombre non appliqué');
    assert(kept, 'mode sombre perdu au rechargement');
  });

  // ================================================================ 4. annotations
  await step('4. Annotations : point, ligne, polygone, rectangle, cercle, flèche, texte, repères, cotation, croquis', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    await rightTab('couche');
    await jumpTo(drawEmprise.lng, drawEmprise.lat, 18);
    const res: string[] = [];
    const errs: string[] = [];
    const run = async (label: string, key: string, kind: string, fn: () => Promise<void>, check?: (f: any) => string | null) => {
      const n0 = (await annotationFeatures()).length;
      if (key.length === 1) await page.keyboard.press(key);
      else await page.getByTestId(key).click();
      await sleep(250);
      await fn();
      await sleep(400);
      const feats = await annotationFeatures();
      const nf = feats.slice(n0);
      const f = nf[nf.length - 1];
      const ok = nf.length === 1 && f?.properties?._kind === kind;
      const extra = ok && check ? check(f) : null;
      res.push(`${ok && !extra ? '✓' : '✗'} ${label} (${nf.length} objet, ${f?.properties?._kind || '-'}, ${f?.geometry?.type || '-'}${f?.geometry?.coordinates && f.geometry.type !== 'Point' ? `, ${JSON.stringify(f.geometry.coordinates).split('],[').length} sommets` : ''})${extra ? ` — ${extra}` : ''}`);
      if (!ok || extra) errs.push(label);
      await page.keyboard.press('Escape');
      await sleep(150);
    };
    await run('point (bouton)', 'tool-draw-point', 'point', () => drawPx([[-250, -150]], 'none'));
    await run('ligne (touche L)', 'l', 'line', () => drawPx([[-250, -100], [-180, -60], [-120, -110]], 'last'));
    await run('polygone (touche G)', 'g', 'polygon', () => drawPx([[-80, -160], [0, -170], [10, -100], [-70, -90]], 'first'));
    await run('rectangle (touche R)', 'r', 'rectangle', async () => {
      await clickAt(await centerPx(40, -170));
      await page.mouse.move(...(await centerPx(110, -110)), { steps: 6 });
      await clickAt(await centerPx(110, -110), { pause: 400 });
    });
    await run('cercle (touche C)', 'c', 'circle', async () => {
      await clickAt(await centerPx(200, -140));
      await page.mouse.move(...(await centerPx(240, -140)), { steps: 6 });
      await clickAt(await centerPx(240, -140), { pause: 400 });
    }, (f) => (f.properties.rayon_m > 0 ? null : 'rayon absent'));
    await run('flèche (touche A)', 'a', 'arrow', () => drawPx([[-250, 0], [-150, 30]], 'last'));
    dialogAnswers.push('Texte E2E');
    await run('texte (touche T)', 't', 'text', () => drawPx([[-80, 0]], 'none'), (f) => (f.properties._text === 'Texte E2E' ? null : `texte « ${f.properties._text} »`));
    dialogAnswers.push('Entrée principale');
    await run('repère numéroté 1 (touche N)', 'n', 'marker', () => drawPx([[20, 10]], 'none'), (f) => (f.properties._num === 1 && f.properties._legend === 'Entrée principale' ? null : `n° ${f.properties._num} « ${f.properties._legend} »`));
    dialogAnswers.push('Parking');
    await run('repère numéroté 2', 'n', 'marker', () => drawPx([[70, 10]], 'none'), (f) => (f.properties._num === 2 ? null : `n° ${f.properties._num}`));
    let dimExpected = 0;
    await run('cotation (touche D)', 'd', 'dimension', async () => {
      const a = await pxLngLat(120, 60);
      const b = await pxLngLat(240, 60);
      dimExpected = turf.distance(a, b, { units: 'meters' });
      await drawPx([[120, 60], [240, 60]], 'last');
    }, (f) => {
      const L = turf.length(f, { units: 'meters' });
      return near(L, dimExpected, 0.02) ? null : `longueur ${L.toFixed(1)} m au lieu de ${dimExpected.toFixed(1)} m`;
    });
    await run('croquis à main levée (touche F)', 'f', 'freehand', async () => {
      const s0 = await centerPx(-250, 120);
      await clickAt(s0);
      for (let i = 1; i <= 20; i++) await page.mouse.move(s0[0] + i * 10, s0[1] + Math.sin(i / 2) * 25, { steps: 2 });
      await clickAt([s0[0] + 200, s0[1] + Math.sin(10) * 25], { pause: 400 });
    });
    for (const r of res) note(r);
    // liste des repères et propriétés du texte
    const feats = await annotationFeatures();
    const txt = feats.find((f) => f.properties._kind === 'text');
    if (txt) {
      await S(`(st, fid) => { const l = st.site.layers.find(l => l.role === 'annotations'); st.select({ layerId: l.id, fid }); }`, txt.properties._fid);
      await sleep(200);
      await page.getByTestId('ann-size').fill('24');
      await sleep(200);
      const t2 = (await annotationFeatures()).find((f) => f.properties._fid === txt.properties._fid);
      note(`taille du texte modifiée dans le panneau : ${t2.properties._size}`);
      if (t2.properties._size !== 24) errs.push('taille du texte');
    }
    const ml = await page.getByTestId('marker-list').innerText().catch(() => '');
    note(`liste des repères : ${ml.replace(/\n/g, ' ')}`);
    if (!/Entrée principale/.test(ml) || !/Parking/.test(ml)) errs.push('liste des repères');
    await shot('4-annotations');
    assert(!errs.length, `outils en défaut : ${errs.join(', ')}`);
  });

  // ================================================================ 5. mesures
  await step('5. Mesures : distance, surface, périmètre (plausibilité)', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    await page.keyboard.press('Escape');
    await rightTab('analyse');
    await jumpTo(drawEmprise.lng, drawEmprise.lat, 17);
    // distance : 2 segments
    await page.getByTestId('measure-distance').click();
    const P = [[-200, 150], [0, 150], [0, 50]] as [number, number][];
    const ll = await Promise.all(P.map((p) => pxLngLat(p[0], p[1])));
    await drawPx(P, 'last');
    const exp = turf.length(turf.lineString(ll), { units: 'meters' });
    const rt = await page.getByTestId('measure-result').innerText();
    const got = frNum(rt);
    note(`distance mesurée : ${rt.split('\n')[0]} ; géodésique indépendante (turf) : ${exp.toFixed(1)} m ; écart ${(((got - exp) / exp) * 100).toFixed(3)} %`);
    assert(near(got, exp, 0.005), 'distance non plausible');
    assert(/Segment 2/.test(rt), 'détail des segments absent');
    // « Garder sur la carte »
    const n0 = (await annotationFeatures()).length;
    await page.getByTestId('measure-save').click();
    await sleep(300);
    note(`« Garder sur la carte » : ${(await annotationFeatures()).length - n0} annotation ajoutée`);
    await rightTab('analyse');
    // surface et périmètre : rectangle de pixels
    await page.getByTestId('measure-area').click();
    const Q = [[-150, -150], [100, -150], [100, 0], [-150, 0]] as [number, number][];
    const ql = await Promise.all(Q.map((p) => pxLngLat(p[0], p[1])));
    await drawPx(Q, 'first');
    const poly = turf.polygon([[...ql, ql[0]]]);
    const expA = turf.area(poly);
    const expP = turf.length(turf.polygonToLine(poly) as any, { units: 'meters' });
    const rt2 = await page.getByTestId('measure-result').innerText();
    const [la, lp] = rt2.split('\n');
    const gotA = la.includes('ha') ? frNum(la.split('(')[1] || '') : frNum(la);
    const gotP = frNum(rt2.split('Périmètre')[1] || '');
    note(`surface mesurée : ${la} ; turf : ${expA.toFixed(0)} m² (écart ${(((gotA - expA) / expA) * 100).toFixed(3)} %)`);
    note(`${lp} ; turf : ${expP.toFixed(1)} m (écart ${(((gotP - expP) / expP) * 100).toFixed(3)} %)`);
    assert(near(gotA, expA, 0.01) && near(gotP, expP, 0.01), 'surface ou périmètre non plausible');
    await page.keyboard.press('Escape');
  });

  // ================================================================ 6. analyses
  await step('6.1 Synthèse d’une zone + export CSV', async () => {
    if (!sites.draw) throw new Skip('site dessiné absent');
    await rightTab('analyse');
    await page.getByTestId('zone-a').selectOption('emprise');
    await page.getByTestId('synthesis-run').click();
    const t = page.getByTestId('synthesis-table');
    await t.waitFor({ timeout: 60000 });
    const rows = await t.locator('tbody tr').evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent?.trim())));
    fs.writeFileSync(path.join(OUT, 'synthese-emprise.json'), JSON.stringify(rows, null, 1));
    for (const r of rows.slice(0, 40)) note(`${r[0]} : ${r[1]}`);
    assert(rows.length > 8, 'tableau de synthèse trop court');
    const d = await download(() => page.getByTestId('synthesis-csv').click(), 30000);
    const csv = d.buf.toString('utf8');
    note(`CSV ${d.name} : ${d.size} octets, ${csv.split(/\r?\n/).length} lignes ; en-tête « ${csv.split(/\r?\n/)[0].slice(0, 80)} »`);
    assert(d.size > 100 && /;/.test(csv), 'CSV vide ou mal formé');
  });

  await step('6.2 Comparaison de deux zones (emprise / zone dessinée)', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    // zone dessinée
    dialogAnswers.push('Zone E2E');
    await page.getByTestId('zone-draw').click();
    await sleep(200);
    await drawPx([[-120, -100], [80, -110], [90, 60], [-110, 70]], 'first');
    await sleep(500);
    const opts = await page.getByTestId('zone-a').locator('option').allInnerTexts();
    note(`zones proposées : ${opts.join(' | ')}`);
    assert(opts.some((o) => o === 'Zone E2E'), 'la zone dessinée n’apparaît pas');
    await page.getByTestId('zone-a').selectOption({ label: 'Emprise du site' });
    const zb = await page.getByTestId('zone-b').locator('option', { hasText: 'Zone E2E' }).getAttribute('value');
    await page.getByTestId('zone-b').selectOption(zb!);
    await page.getByTestId('synthesis-run').click();
    await sleep(1500);
    const t = page.getByTestId('synthesis-table');
    const heads = await t.locator('thead th').allInnerTexts();
    note(`colonnes : ${heads.join(' | ')}`);
    const rows = await t.locator('tbody tr').evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent?.trim())));
    for (const r of rows.slice(0, 6)) note(`${r[0]} : ${r[1]} | ${r[2]}`);
    assert(heads.length === 3, 'la comparaison n’affiche pas deux zones côte à côte');
    const d = await download(() => page.getByTestId('synthesis-csv').click(), 30000);
    note(`CSV de comparaison : ${d.size} octets, en-tête « ${d.buf.toString('utf8').split(/\r?\n/)[0]} »`);
  });

  await step('6.3 Profil topographique', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    await page.getByTestId('profile-run').click();
    await sleep(200);
    await drawPx([[-250, 0], [0, 40], [250, 0]], 'last');
    await waitFor(async () => (await page.getByTestId('profile-chart').count()) > 0 || (await page.getByTestId('analysis-error').count()) > 0, 'profil calculé', 60000);
    if (await page.getByTestId('analysis-error').count()) throw new Error(await page.getByTestId('analysis-error').innerText());
    const txt = await page.getByTestId('profile-chart').innerText();
    note(txt.replace(/\n/g, ' · ').slice(0, 300));
    const L = frNum(txt.split('Longueur')[1] || '');
    assert(L > 50, 'longueur du profil invalide');
    const altm = txt.match(/altitude\s+(-?[\d,.]+)\s+à\s+(-?[\d,.]+)/);
    const alt = altm ? [Number(altm[1].replace(',', '.')), Number(altm[2].replace(',', '.'))] : [];
    if (altm && /\d\.\d/.test(altm[0])) note('NB : altitudes et dénivelés affichés avec un point décimal (« 6.4 m ») alors que le reste de l’interface utilise la virgule');
    note(`altitudes ${alt.join(' à ')} m (MNS Médina : 0 à 40 m attendus)`);
    assert(alt.length === 2 && alt[0] > -5 && alt[1] < 80, 'altitudes non plausibles');
    const d = await download(() => page.getByTestId('profile-chart').getByRole('button', { name: /CSV du profil/ }).click(), 15000);
    note(`CSV du profil : ${d.size} octets`);
  });

  await step('6.4 Zone tampon autour d’un objet sélectionné', async () => {
    const lid = imported['points.csv']?.[0];
    if (!lid) throw new Skip('couche points absente');
    const fc = await layerData(lid);
    const fid = fc.features[0].properties._fid;
    await S(`(st, a) => st.select({ layerId: a[0], fid: a[1] })`, [lid, fid]);
    await rightTab('analyse');
    const sec = page.getByTestId('buffer-section');
    note(await sec.innerText().then((t) => t.split('\n').slice(1, 2).join(' ')));
    await page.getByTestId('buffer-distance').fill('50');
    const ids0 = new Set((await siteState()).layers.map((l) => l.id));
    await page.getByTestId('buffer-run').click();
    await sleep(500);
    const nl = (await siteState()).layers.filter((l) => !ids0.has(l.id));
    assert(nl.length === 1, 'aucune couche tampon créée');
    const bfc = await layerData(nl[0].id);
    const a = turf.area(bfc.features[0]);
    note(`« ${nl[0].name} » : ${bfc.features.length} objet(s), surface ${a.toFixed(0)} m² (π·50² = ${(Math.PI * 2500).toFixed(0)})`);
    assert(near(a, Math.PI * 2500, 0.03), 'surface du tampon non plausible');
  });

  await step('6.5 Isochrones (Valhalla public, sans clé)', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    await page.getByTestId('iso-mode').selectOption('walk');
    await page.getByTestId('iso-minutes').fill('5, 10');
    const ids0 = new Set((await siteState()).layers.map((l) => l.id));
    await page.getByTestId('iso-run').click();
    await sleep(200);
    await clickAt(await centerPx(0, 0));
    await waitFor(async () => (await siteState()).layers.some((l) => !ids0.has(l.id)) || (await page.getByTestId('analysis-error').count()) > 0, 'isochrones calculées', 90000, 500);
    if (await page.getByTestId('analysis-error').count()) throw new Error(await page.getByTestId('analysis-error').innerText());
    const nl = (await siteState()).layers.filter((l) => !ids0.has(l.id));
    const fc = await layerData(nl[0].id);
    const polys = fc.features.filter((f: any) => /Polygon/.test(f.geometry.type));
    note(`« ${nl[0].name} » : ${polys.map((f: any) => `${f.properties.minutes} min = ${(turf.area(f) / 1e4).toFixed(1)} ha`).join(', ')}`);
    assert(polys.length === 2, 'nombre d’isochrones incorrect');
    const [p10, p5] = polys;
    assert(turf.area(p10) > turf.area(p5), 'l’isochrone 10 min devrait être plus grande que 5 min');
    // 5 min à pied ≈ 400 m : surface plausible entre 5 et 100 ha
    assert(turf.area(p5) > 5e4 && turf.area(p5) < 1e6, 'surface de l’isochrone 5 min non plausible');
  });

  await step('6.6 Carte de chaleur et carte de densité (hexagones)', async () => {
    const sec = page.getByTestId('density-section');
    const opts = await page.getByTestId('density-layer').locator('option').allInnerTexts();
    note(`couches de points proposées : ${opts.join(' | ')}`);
    const amen = await page.getByTestId('density-layer').locator('option').first().getAttribute('value');
    await page.getByTestId('density-layer').selectOption(amen!);
    const ids0 = new Set((await siteState()).layers.map((l) => l.id));
    await page.getByTestId('heatmap-run').click();
    await sleep(800);
    let nl = (await siteState()).layers.filter((l) => !ids0.has(l.id));
    assert(nl.length === 1 && nl[0].style.mode === 'heatmap', 'couche de chaleur non créée');
    const heat = await page.evaluate((id) => (window as any).__map.getLayer(`lyr-${id}-heat`)?.type, nl[0].id);
    note(`« ${nl[0].name} » : ${nl[0].count} points, couche MapLibre ${heat}`);
    assert(heat === 'heatmap', 'couche heatmap absente de la carte');
    const ids1 = new Set((await siteState()).layers.map((l) => l.id));
    await sec.locator('input[type=number]').fill('50');
    await page.getByTestId('density-run').click();
    await sleep(800);
    nl = (await siteState()).layers.filter((l) => !ids1.has(l.id));
    assert(nl.length === 1, 'couche de densité non créée');
    const fc = await layerData(nl[0].id);
    const tot = fc.features.reduce((s: number, f: any) => s + (Number(f.properties.nombre) || 0), 0);
    const src = await layerData(amen!);
    const inBuf = src.features.filter((f: any) => f.geometry.type === 'Point').length;
    note(`« ${nl[0].name} » : ${fc.features.length} hexagones, ${tot} points comptés (couche source : ${inBuf} points)`);
    assert(fc.features.length > 0 && tot > 0, 'grille de densité vide');
    await shot('6-analyses');
  });

  // ================================================================ 7. implantation
  let planId = '';
  await step('7.1 Plan DXF local (projet_local.dxf) : import, déplacement, rotation, échelle', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    await jumpTo(drawEmprise.lng, drawEmprise.lat, 19);
    await rightTab('projet');
    await page.getByTestId('project-units').selectOption('auto');
    await clearToasts();
    const ids0 = new Set((await siteState()).layers.map((l) => l.id));
    await page.getByTestId('project-dxf-input').setInputFiles(path.join(FIX, 'projet_local.dxf'));
    const t = await waitToast(/Plan|erreur|Erreur/, 20000);
    note(`message : ${t.text}`);
    const nl = (await siteState()).layers.filter((l) => !ids0.has(l.id));
    assert(nl.length === 1 && nl[0].placement, 'plan non importé ou sans calage');
    planId = nl[0].id;
    const fc = await layerData(planId);
    note(`« ${nl[0].name} » : ${fc.features.length} objets (${[...new Set(fc.features.map((f: any) => `${f.properties.calque}/${f.geometry.type}`))].join(', ')}), ancrage ${nl[0].placement.anchor.map((x: number) => x.toFixed(6))}`);
    await mapIdle();
    const pl = async () => (await siteState()).layers.find((l) => l.id === planId)!.placement;
    // déplacer à la souris
    const a0 = (await pl()).anchor;
    await page.getByTestId('calage-move').click();
    const c = await centerPx(0, 0);
    await page.mouse.move(c[0], c[1]);
    await page.mouse.down();
    await page.mouse.move(c[0] + 60, c[1] - 40, { steps: 10 });
    await page.mouse.up();
    await sleep(300);
    await page.getByTestId('calage-move').click();
    const a1 = (await pl()).anchor;
    const dm = turf.distance(a0, a1, { units: 'meters' });
    note(`déplacement à la souris (72 px) : ${dm.toFixed(1)} m`);
    assert(dm > 3, 'le déplacement à la souris n’a pas bougé le plan');
    // flèche → (1 m)
    await page.getByTestId('calage-section').getByRole('button', { name: '→' }).click();
    await sleep(200);
    const a2 = (await pl()).anchor;
    const d2 = turf.distance(a1, a2, { units: 'meters' });
    note(`flèche → : ${d2.toFixed(3)} m vers l’${turf.bearing(a1, a2) > 0 ? 'est' : 'ouest'}`);
    assert(Math.abs(d2 - 1) < 0.02, 'déplacement de 1 m incorrect');
    // rotation et échelle
    await page.getByTestId('calage-rotation').fill('15');
    await sleep(200);
    await page.getByTestId('calage-scale').fill('1.5');
    await sleep(300);
    const p3 = await pl();
    const fc3 = await layerData(planId);
    const bat = fc3.features.filter((f: any) => f.properties.calque === 'BATIMENT' && /Polygon/.test(f.geometry.type));
    const aBat = bat.reduce((s: number, f: any) => s + turf.area(f), 0);
    note(`rotation ${p3.rotation}°, échelle ${p3.scale} → surface du bâtiment ${aBat.toFixed(1)} m² (attendu 272 × 1,5² = 612)`);
    assert(p3.rotation === 15 && p3.scale === 1.5, 'rotation/échelle non appliquées');
    assert(near(aBat, 612, 0.01), 'surface après mise à l’échelle incorrecte');
    await page.getByTestId('calage-scale').fill('1');
    await sleep(200);
  });

  /** Calage par points : chaque paire (point local du plan → point réel). */
  async function calage(pairs: { local: [number, number]; target: [number, number] }[], layerId: string) {
    await page.getByTestId('calage-points').click();
    await sleep(200);
    for (const p of pairs) {
      const cur = await localToLngLat(layerId, p.local);
      await clickAt(await lngLatPx(cur[0], cur[1]), { pause: 300 });
      await clickAt(await lngLatPx(p.target[0], p.target[1]), { pause: 300 });
    }
    await page.getByTestId('calage-apply').click();
    await sleep(400);
  }
  /** Position actuelle d'un point du plan (coordonnées locales en mètres), d'après un sommet connu. */
  async function localToLngLat(layerId: string, loc: [number, number]): Promise<[number, number]> {
    // sommets du bâtiment en L : (0,0) (24,0) (24,6) (8,6) (8,16) (0,16) ; parcelle (-4,-4) (28,-4) (28,20) (-4,20)
    const known: Record<string, [string, number]> = { '0,0': ['BATIMENT', 0], '24,0': ['BATIMENT', 1], '0,16': ['BATIMENT', 5], '-4,-4': ['PARCELLE', 0], '28,-4': ['PARCELLE', 1], '28,20': ['PARCELLE', 2] };
    const k = known[loc.join(',')];
    assert(k, `sommet local inconnu ${loc}`);
    const fc = await layerData(layerId);
    const f = fc.features.find((x: any) => x.properties.calque === k[0] && x.geometry.type === 'Polygon' && (k[0] !== 'BATIMENT' || x.geometry.coordinates[0].length === 7));
    assert(f, `polygone ${k[0]} introuvable`);
    return f.geometry.coordinates[0][k[1]];
  }

  await step('7.2 Calage du plan DXF par 2 points puis par 3 points', async () => {
    if (!planId || !drawEmprise) throw new Skip('plan non importé');
    await jumpTo(drawEmprise.lng, drawEmprise.lat, 19);
    // cible : coin (0,0) au centre de la vue, axe X du plan orienté à 30° au nord de l'est, échelle 1
    const T0 = await pxLngLat(-60, 40);
    const T1 = turf.destination(T0, 24 / 1000, 90 - 30).geometry.coordinates as [number, number];
    await calage(
      [
        { local: [0, 0], target: T0 },
        { local: [24, 0], target: T1 },
      ],
      planId,
    );
    let t = await lastToast();
    let pl = (await siteState()).layers.find((l) => l.id === planId)!.placement;
    let v0 = await localToLngLat(planId, [0, 0]);
    let err0 = turf.distance(v0, T0, { units: 'meters' });
    note(`2 points : ${t?.text} ; placement rotation ${pl.rotation.toFixed(2)}°, échelle ${pl.scale.toFixed(4)} ; écart du coin (0,0) à sa cible ${err0.toFixed(2)} m`);
    assert(Math.abs(pl.scale - 1) < 0.03 && Math.abs(Math.abs(pl.rotation) - 30) < 1.5 && err0 < 0.6, 'calage 2 points imprécis');
    // 3 points : rotation -20°, échelle 1 ; cibles exactes
    await mapIdle();
    const U0 = await pxLngLat(-40, 60);
    const ang = -20;
    const dest = (x: number, y: number) => {
      const r = (ang * Math.PI) / 180;
      const ex = x * Math.cos(r) - y * Math.sin(r);
      const ny = x * Math.sin(r) + y * Math.cos(r);
      const d = Math.hypot(ex, ny);
      const brg = (Math.atan2(ex, ny) * 180) / Math.PI;
      return turf.destination(U0, d / 1000, brg).geometry.coordinates as [number, number];
    };
    await calage(
      [
        { local: [0, 0], target: U0 },
        { local: [24, 0], target: dest(24, 0) },
        { local: [0, 16], target: dest(0, 16) },
      ],
      planId,
    );
    t = await lastToast();
    pl = (await siteState()).layers.find((l) => l.id === planId)!.placement;
    v0 = await localToLngLat(planId, [0, 0]);
    err0 = turf.distance(v0, U0, { units: 'meters' });
    const rms = Number((t?.text.match(/écart moyen ([\d.,]+)/) || [])[1]?.replace(',', '.'));
    note(`3 points : ${t?.text} ; rotation ${pl.rotation.toFixed(2)}°, échelle ${pl.scale.toFixed(4)} ; écart du coin (0,0) ${err0.toFixed(2)} m`);
    assert(/écart moyen/.test(t?.text || ''), 'l’écart moyen n’est pas affiché avec 3 points');
    assert(Math.abs(pl.scale - 1) < 0.03 && Math.abs(pl.rotation - ang) < 1.5 && err0 < 0.6 && rms < 1, 'calage 3 points imprécis');
    await shot('7.2-calage-dxf');
  });

  await step('7.3 Calculs du projet (emprise, surface de plancher, CES, COS)', async () => {
    if (!planId) throw new Skip('plan non importé');
    await rightTab('projet');
    await page.getByTestId('project-select').selectOption(planId);
    await sleep(300);
    if ((await S<string>(`(st) => st.rightTab`)) !== 'projet') await rightTab('projet');
    const tbl = page.getByTestId('project-table');
    await tbl.waitFor();
    const read = async () => Object.fromEntries((await tbl.locator('tr').evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent?.trim())))).map((r) => [r[0], r[1]]));
    let v = await read();
    note(JSON.stringify(v));
    await page.getByTestId('project-levels').fill('5');
    await sleep(300);
    v = await read();
    note(`5 niveaux : ${JSON.stringify(v)}`);
    const emp = frNum(v['Emprise au sol']);
    const pla = frNum(v['Surface de plancher']);
    const par = frNum(v['Surface de la parcelle']);
    const ces = frNum(v['Emprise / parcelle (CES)']);
    const cos = frNum(v['Plancher / parcelle (COS)']);
    note(`attendu (échelle ≈ 1) : emprise 272 m², plancher 1 360 m², parcelle 768 m², CES 35,4 %, COS 1,77`);
    assert(near(emp, 272, 0.05) && near(pla, 1360, 0.05) && near(par, 768, 0.05) && near(ces, 35.4, 0.05) && near(cos, 1.77, 0.05), 'calculs du projet incorrects');
  });

  await step('7.4 Image calée avec transparence (import, échelle, calage 2 points)', async () => {
    if (!drawEmprise) throw new Skip('site dessiné absent');
    const img = path.join(OUT, 'plan-scanne-e2e.png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#fffbe6"/><rect x="40" y="40" width="320" height="220" fill="none" stroke="#c00" stroke-width="6"/><line x1="40" y1="40" x2="360" y2="260" stroke="#00c" stroke-width="4"/><text x="60" y="160" font-size="36" fill="#333">PLAN E2E</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(img);
    await jumpTo(drawEmprise.lng, drawEmprise.lat, 18);
    await rightTab('projet');
    const ids0 = new Set((await siteState()).layers.map((l) => l.id));
    await page.getByTestId('project-image-input').setInputFiles(img);
    await waitFor(async () => (await siteState()).layers.some((l) => !ids0.has(l.id)), 'image importée', 20000);
    const l = (await siteState()).layers.find((x) => !ids0.has(x.id))!;
    note(`« ${l.name} » : ${l.kind}, opacité ${l.opacity}, ${l.raster?.url}, échelle ${l.placement.scale.toFixed(4)} m/px`);
    await mapIdle();
    const r = await fetch(l.raster.url.startsWith('files/') ? `${BASE}/api/sites/${sites.draw}/${l.raster.url}` : `${BASE}${l.raster.url}`);
    note(`image servie : HTTP ${r.status}, ${(await r.arrayBuffer()).byteLength} octets`);
    await page.getByTestId('calage-opacity').fill('0.4');
    await sleep(300);
    const op = await page.evaluate((id) => (window as any).__map.getPaintProperty(`lyr-${id}-raster`, 'raster-opacity'), l.id);
    note(`transparence 60 % → raster-opacity MapLibre = ${op}`);
    assert(Math.abs(op - 0.4) < 0.01, 'transparence non appliquée');
    await page.getByTestId('calage-scale').fill('0.25');
    await sleep(200);
    const corners = (await siteState()).layers.find((x) => x.id === l.id)!.raster.corners;
    const w = turf.distance(corners[0], corners[1], { units: 'meters' });
    note(`échelle 0,25 m/px → largeur ${w.toFixed(1)} m (attendu 100 m)`);
    assert(near(w, 100, 0.01), 'échelle de l’image incorrecte');
    // calage 2 points : coin haut-gauche de l'image → cible, coin haut-droit → 80 m à l'est
    const c0 = corners[0] as [number, number];
    const c1 = corners[1] as [number, number];
    const T0 = await pxLngLat(-150, -80);
    const T1 = turf.destination(T0, 0.08, 90).geometry.coordinates as [number, number];
    await page.getByTestId('calage-points').click();
    await clickAt(await lngLatPx(c0[0], c0[1]));
    await clickAt(await lngLatPx(T0[0], T0[1]));
    await clickAt(await lngLatPx(c1[0], c1[1]));
    await clickAt(await lngLatPx(T1[0], T1[1]));
    await page.getByTestId('calage-apply').click();
    await sleep(400);
    const t = await lastToast();
    const cs = (await siteState()).layers.find((x) => x.id === l.id)!.raster.corners;
    const w2 = turf.distance(cs[0], cs[1], { units: 'meters' });
    const e0 = turf.distance(cs[0], T0, { units: 'meters' });
    note(`${t?.text} → largeur ${w2.toFixed(1)} m (attendu 80), coin haut-gauche à ${e0.toFixed(2)} m de sa cible`);
    assert(near(w2, 80, 0.03) && e0 < 1, 'calage de l’image imprécis');
    await shot('7.4-image-calee');
  });

  await step('7.5 Vue 3D', async () => {
    await page.getByTestId('toolbar-3d').click();
    await sleep(1500);
    const r = await page.evaluate(() => {
      const m = (window as any).__map;
      return { pitch: m.getPitch(), ext: m.getStyle().layers.filter((l: any) => l.type === 'fill-extrusion').map((l: any) => l.id) };
    });
    await shot('7.5-vue-3d');
    note(`inclinaison ${r.pitch.toFixed(0)}°, ${r.ext.length} couche(s) extrudée(s) : ${r.ext.join(', ')}`);
    assert(r.pitch > 30 && r.ext.length >= 1, 'vue 3D sans extrusion');
    assert(r.ext.some((id: string) => planId && id.includes(planId)), 'le projet n’est pas extrudé');
  });

  await step('7.6 Ombres portées (date, heure, curseur)', async () => {
    await rightTab('projet');
    await page.getByTestId('shadow-date').fill('2026-12-21');
    await page.getByTestId('shadow-time').fill('16:00');
    await page.getByTestId('shadow-run').click();
    await sleep(800);
    const info = await page.getByTestId('shadow-info').innerText();
    const sl = (await siteState()).layers.find((l) => l.role === 'shadow');
    const fc = sl ? await layerData(sl.id) : null;
    note(`21/12 16:00 : ${info} ; « ${sl?.name} » ${fc?.features.length} ombre(s)`);
    assert(/hauteur/.test(info) && fc && fc.features.length > 0, 'pas d’ombres calculées');
    const alt = frNum(info.split('hauteur')[1]);
    // Dakar 21 décembre 16 h UTC : soleil ≈ 25-30° au sud-ouest
    assert(alt > 15 && alt < 40, `hauteur du soleil peu plausible (${alt}°)`);
    await page.getByTestId('shadow-slider').fill('720');
    await sleep(800);
    const info2 = await page.getByTestId('shadow-info').innerText();
    note(`curseur 12:00 : ${info2}`);
    await page.getByTestId('shadow-time').fill('21:30');
    await sleep(800);
    note(`21:30 : ${await page.getByTestId('shadow-info').innerText()}`);
    await page.getByTestId('toolbar-3d').click();
    await sleep(600);
  });

  await step('7.7 Dessiner l’emprise d’un projet', async () => {
    await rightTab('projet');
    await page.getByTestId('project-draw').click();
    await sleep(200);
    await drawPx([[150, 100], [250, 100], [250, 180], [150, 180]], 'first');
    await sleep(400);
    const l = (await siteState()).layers.find((x) => x.name === 'Emprise du projet');
    const fc = l ? await layerData(l.id) : null;
    note(`« Emprise du projet » : ${fc?.features.length ?? 0} polygone(s), ${fc?.features[0] ? turf.area(fc.features[0]).toFixed(0) : '-'} m²`);
    assert(fc && fc.features.length === 1, 'emprise du projet non dessinée');
    await page.keyboard.press('Escape');
    // choisir un autre projet dans la liste de l'onglet Projet
    await rightTab('projet');
    const opts = await page.getByTestId('project-select').locator('option').allInnerTexts();
    await page.getByTestId('project-select').selectOption(planId);
    await sleep(300);
    const tabAfter = await S<string>(`(st) => st.rightTab`);
    note(`liste des projets : ${opts.join(' | ')} ; après choix de « Plan — projet_local » l’onglet actif est « ${tabAfter} »`);
    if (tabAfter !== 'projet') await rightTab('projet');
    assert(tabAfter === 'projet', 'choisir un projet dans la liste de l’onglet Projet bascule sur l’onglet Couche (le panneau Projet disparaît)');
  });

  // ================================================================ 8. mise en page et exports
  await step('8.1 Mise en page : nouvelle planche, format, échelle, éléments', async () => {
    await saved();
    await page.getByTestId('layout-open').click();
    await page.getByTestId('layout-editor').waitFor();
    await page.getByTestId('layout-page').waitFor({ timeout: 30000 });
    await page.getByTitle('Nouvelle mise en page').click();
    await sleep(500);
    const n = await page.getByTestId('layout-select').locator('option').count();
    note(`${n} mise(s) en page`);
    await page.getByTestId('layout-format').selectOption('A3');
    await page.getByTestId('layout-orientation').selectOption('landscape');
    await page.getByTestId('layout-scale').selectOption('2000');
    await sleep(300);
    for (const e of ['logo', 'inset', 'subtitle', 'text']) await page.getByTestId(`add-${e}`).click();
    await sleep(300);
    const ta = page.getByTestId('element-props').locator('textarea').first();
    await ta.fill('Texte libre E2E');
    await ta.press('Tab');
    await sleep(300);
    const lay = await S<any>(`(st) => st.site.layouts[st.site.layouts.length - 1]`);
    note(`planche « ${lay.name} » : ${lay.format} ${lay.orientation}, ${lay.width}×${lay.height} mm, 1/${lay.scale}, éléments : ${lay.elements.map((e: any) => e.type).join(', ')}`);
    assert(lay.format === 'A3' && lay.scale === 2000 && lay.width === 420, 'réglages de la planche non appliqués');
    assert(lay.elements.some((e: any) => e.type === 'text' && e.props.text === 'Texte libre E2E'), 'texte libre absent');
    // déplacer un élément à la souris (le texte libre)
    await mapIdleLayout();
    await shot('8.1-mise-en-page');
  });
  async function mapIdleLayout() {
    await waitFor(async () => !(await page.getByText('fond de carte…').count()), 'aperçu du fond', 60000).catch(() => {});
  }

  const exportsOk: Record<string, string> = {};
  for (const k of ['png', 'pdf', 'svg'] as const) {
    await step(`8.2 Export de la planche en ${k.toUpperCase()}`, async () => {
      await mapIdleLayout();
      const t0 = Date.now();
      const d = await download(() => page.getByTestId(`export-${k}`).click(), 600000);
      const head = d.buf.subarray(0, 8);
      let ok = false;
      let det = '';
      if (k === 'png') {
        ok = head.toString('hex') === '89504e470d0a1a0a';
        const m = await sharp(d.buf).metadata();
        det = `${m.width}×${m.height} px, ${m.density} dpi, ${m.channels} canaux`;
        // A3 paysage à 300 dpi = 4961 × 3508
        if (Math.abs((m.width || 0) - 4961) > 3) det += ' — taille inattendue';
      } else if (k === 'pdf') {
        ok = head.toString('latin1').startsWith('%PDF');
        det = `${(d.buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length} page(s)`;
      } else {
        const s = d.buf.toString('utf8', 0, 400);
        ok = /<svg|<\?xml/.test(s);
        det = `${(d.buf.toString('utf8').match(/<text/g) || []).length} textes`;
      }
      exportsOk[k] = d.file;
      note(`${d.name} : ${(d.size / 1e6).toFixed(2)} Mo en ${((Date.now() - t0) / 1000).toFixed(0)} s, en-tête ${ok ? 'valide' : 'INVALIDE'} ; ${det}`);
      assert(d.size > 1000 && ok, `fichier ${k} invalide`);
    });
  }

  await step('8.3 Modèle de mise en page : enregistrer puis supprimer', async () => {
    const t0 = await (await fetch(`${BASE}/api/templates`)).json();
    dialogAnswers.push('Modèle E2E');
    await page.getByTestId('template-save').click();
    await page.getByRole('button', { name: 'Modèle E2E' }).waitFor();
    const t1 = await (await fetch(`${BASE}/api/templates`)).json();
    note(`modèles : ${t0.length} → ${t1.length}`);
    assert(t1.length === t0.length + 1, 'modèle non enregistré');
    await page.getByRole('button', { name: 'Modèle E2E' }).locator('..').locator('button').last().click();
    await sleep(500);
    const t2 = await (await fetch(`${BASE}/api/templates`)).json();
    note(`après suppression : ${t2.length}`);
    assert(t2.length === t0.length, 'modèle non supprimé');
    await page.getByTestId('layout-close').click();
    await sleep(500);
  });

  await step('8.4 Exports de données : GeoJSON, GeoPackage, DXF', async () => {
    if (await page.getByTestId('layout-close').count()) await page.getByTestId('layout-close').click();
    const problems: string[] = [];
    const visible = (await siteState()).layers.filter((l) => l.visible && l.kind === 'vector' && (l.count || 0) > 0).length;
    // GeoJSON (zip d'une couche par fichier, ou fichier unique)
    await page.getByTestId('export-menu').click();
    const g = await download(() => page.getByTestId('export-geojson').click(), 120000);
    if (g.buf.subarray(0, 2).toString() === 'PK') {
      const z = await JSZip.loadAsync(g.buf);
      const names = Object.keys(z.files).filter((n) => !z.files[n].dir);
      let feats = 0;
      for (const n of names.filter((n) => /\.geojson$|\.json$/i.test(n))) {
        try {
          const j = JSON.parse(await z.files[n].async('string'));
          feats += j.features?.length || 0;
          const c = turf.bbox(j);
          if (j.features?.length && !(c[0] > -18 && c[2] < -16.5 && c[1] > 14 && c[3] < 15.5)) problems.push(`GeoJSON ${n} hors WGS84/Dakar`);
        } catch (e: any) {
          problems.push(`GeoJSON ${n} illisible : ${e.message}`);
        }
      }
      note(`${g.name} : zip de ${names.length} fichier(s) (${visible} couches visibles non vides), ${feats} objets, tous parsables : ${!problems.length}`);
    } else {
      const j = JSON.parse(g.buf.toString('utf8'));
      note(`${g.name} : ${j.features?.length} objets`);
    }
    // GeoPackage
    await page.getByTestId('export-menu').click();
    const p = await download(() => page.getByTestId('export-gpkg').click(), 120000);
    try {
      const db = new Database(p.file, { readonly: true, fileMustExist: true });
      const cont = db.prepare('select table_name, data_type, srs_id from gpkg_contents').all() as any[];
      const counts = cont.map((c) => `${c.table_name}=${(db.prepare(`select count(*) n from "${c.table_name}"`).get() as any).n}`);
      const styles = (db.prepare("select count(*) n from sqlite_master where name='layer_styles'").get() as any).n ? (db.prepare('select count(*) n from layer_styles').get() as any).n : 0;
      const app = (db.pragma('application_id', { simple: true }) as number).toString(16);
      note(`${p.name} : ${(p.size / 1e6).toFixed(2)} Mo, application_id 0x${app}, ${cont.length} tables (SRS ${[...new Set(cont.map((c) => c.srs_id))].join(',')}), ${styles} styles QGIS ; ${counts.slice(0, 12).join(', ')}${counts.length > 12 ? '…' : ''}`);
      if (!cont.length) problems.push('GeoPackage sans table');
      if (app !== '47504b47') problems.push('application_id GeoPackage absent');
      db.close();
    } catch (e: any) {
      problems.push(`GeoPackage illisible : ${e.message}`);
    }
    // DXF
    await page.getByTestId('export-menu').click();
    const x = await download(() => page.getByTestId('export-dxf').click(), 120000);
    const txt = x.buf.toString('latin1');
    const ents = (txt.match(/\n\s*0\r?\n(LWPOLYLINE|POLYLINE|LINE|POINT|TEXT|CIRCLE|INSERT)\r?\n/g) || []).length;
    const layersDxf = new Set([...txt.matchAll(/\n\s*8\r?\n([^\r\n]+)/g)].map((m) => m[1])).size;
    // (l'en-tête d'une POLYLINE R12 porte un point 10/20 = 0 par convention : ignoré)
    const xs = [...txt.slice(txt.indexOf('ENTITIES')).matchAll(/\n\s*10\r?\n\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter((v) => Number.isFinite(v) && v !== 0);
    note(`${x.name} : ${(x.size / 1e3).toFixed(0)} ko, ENTITIES ${/ENTITIES/.test(txt) ? 'présent' : 'ABSENT'}, ${ents} entités, ${layersDxf} calques, X de ${Math.min(...xs).toFixed(0)} à ${Math.max(...xs).toFixed(0)} (UTM 28N attendu ≈ 230 000)`);
    if (!/ENTITIES/.test(txt)) problems.push('DXF sans section ENTITIES');
    if (!(Math.min(...xs) > 200000 && Math.max(...xs) < 260000)) problems.push('coordonnées DXF hors UTM 28N');
    assert(!problems.length, problems.join(' ; '));
  });

  await step('8.5 Export vers QGIS (zip : .gpkg + .qgs)', async () => {
    if (await page.getByTestId('layout-close').count()) await page.getByTestId('layout-close').click();
    await page.getByTestId('export-menu').click();
    const q = await download(() => page.getByTestId('export-qgis').click(), 180000);
    const z = await JSZip.loadAsync(q.buf);
    const names = Object.keys(z.files).filter((n) => !z.files[n].dir);
    const qgs = names.find((n) => n.endsWith('.qgs'));
    const gpkg = names.find((n) => n.endsWith('.gpkg'));
    note(`${q.name} : ${(q.size / 1e6).toFixed(2)} Mo, ${names.length} fichiers : ${names.slice(0, 12).join(', ')}`);
    assert(qgs && gpkg, 'le zip QGIS doit contenir un .qgs et un .gpkg');
    const xml = await z.files[qgs].async('string');
    const maplayers = (xml.match(/<maplayer /g) || []).length;
    note(`${qgs} : ${maplayers} couches, ${/EPSG:326\d\d/.test(xml) ? 'UTM' : 'SCR ?'} ; datasources gpkg : ${(xml.match(/\.gpkg\|layername=/g) || []).length}`);
    assert(/<qgis/.test(xml) && maplayers > 0, 'projet .qgs invalide');
    const tmp = path.join(DL, `qgis-${Date.now()}.gpkg`);
    fs.writeFileSync(tmp, await z.files[gpkg].async('nodebuffer'));
    const db = new Database(tmp, { readonly: true });
    const n = (db.prepare('select count(*) n from gpkg_contents').get() as any).n;
    db.close();
    note(`${gpkg} : ${n} tables`);
    assert(n > 0, 'GeoPackage QGIS vide');
  });

  // ================================================================ 9-10. bilan et nettoyage
  await step('9. Contrôle final des erreurs (console navigateur et terminal serveur)', async () => {
    await sleep(1000);
    collectServerLog();
    const real = issues.filter((i) => !i.expected);
    note(`${real.length} erreur(s) navigateur/serveur non attendue(s) sur l’ensemble du parcours ; ${issues.length - real.length} attendue(s) (tests négatifs)`);
    assert(real.length === 0, `${real.length} erreur(s) relevée(s) (voir la liste)`);
  });

  await step('10. Suppression des données de test', async () => {
    if (process.env.E2E_KEEP) {
      note(`E2E_KEEP : sites conservés ${[...created].join(', ')}`);
      return;
    }
    // un site supprimé par l'interface (accueil), les autres par l'API
    await page.goto(BASE);
    await page.getByTestId('site-card').first().waitFor();
    if (sites.search) {
      dialogAnswers.push(true);
      await page.getByTestId('site-card').filter({ hasText: 'E2E Recherche Médina' }).getByRole('button', { name: 'Supprimer' }).click();
      await waitFor(async () => !(await apiSites()).some((s) => s.slug === sites.search), 'suppression par l’interface', 10000);
      created.delete(sites.search);
    }
    for (const s of [...created]) {
      const r = await fetch(`${BASE}/api/sites/${s}`, { method: 'DELETE' });
      note(`DELETE ${s} → ${r.status}`);
      if (r.ok) created.delete(s);
    }
    const left = (await apiSites()).filter((s) => /^E2E /.test(s.name));
    note(`sites E2E restants : ${left.length}`);
    assert(!created.size && !left.length, `sites non supprimés : ${[...created].join(', ')}`);
  });

  await browser.close();
}

function writeJson() {
  const out = { base: BASE, date: new Date().toISOString(), results, issues, infos: infos.slice(-2000), serverLogStart, created: [...created] };
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify(out, null, 1));
}

main()
  .catch((e) => {
    console.error('Arrêt du script :', e);
    results.push({ name: 'arrêt du script', ok: false, ms: 0, notes: [], error: String(e?.message || e) });
  })
  .finally(async () => {
    collectServerLog();
    // filet de sécurité : sites de test restants
    if (!process.env.E2E_KEEP)
      for (const s of [...created]) {
        await fetch(`${BASE}/api/sites/${s}`, { method: 'DELETE' }).catch(() => {});
      }
    writeJson();
    const ko = results.filter((r) => !r.ok);
    const real = issues.filter((i) => !i.expected);
    console.log(`\n==== Bilan : ${results.length - ko.length}/${results.length} étapes OK ; ${real.length} erreur(s) console/serveur ====`);
    for (const r of ko) console.log(`  KO ${r.name} : ${r.error}`);
    const byText = new Map<string, Issue[]>();
    for (const i of real) {
      const k = `[${i.kind}] ${i.text.replace(/\d{3,}/g, 'N').slice(0, 200)}`;
      byText.set(k, [...(byText.get(k) || []), i]);
    }
    for (const [k, v] of byText) console.log(`  ${v.length}× ${k}  (étapes : ${[...new Set(v.map((x) => x.step.split(' ')[0]))].join(', ')})`);
    console.log(`Détails : ${path.join(OUT, 'resultats.json')}`);
    process.exit(ko.length || real.length ? 1 : 0);
  });
