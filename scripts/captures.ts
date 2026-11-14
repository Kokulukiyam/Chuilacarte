/* Captures d'écran de l'interface, pour la revue visuelle.
 *   npx tsx scripts/captures.ts [url] [dossier] [site]
 * Défauts : http://localhost:3500, ./captures, exemple-medina
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3500').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] || 'captures');
const SITE = process.argv[4] || 'exemple-medina';
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const errors: string[] = [];
  for (const theme of ['clair', 'sombre'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: theme === 'sombre' ? 'dark' : 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme} pageerror ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${theme} console ${m.text().slice(0, 200)}`));
    const shot = async (name: string) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${theme}-${name}.png`) });
      console.log(`${theme}-${name}`);
    };
    const step = async (name: string, fn: (p: Page) => Promise<void>) => {
      try {
        await fn(page);
        await shot(name);
      } catch (e: any) {
        console.log(`KO ${theme}-${name} : ${String(e.message).split('\n')[0]}`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    };
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="site-card"], [data-testid="new-site"]');
    await page.waitForTimeout(1200);
    await shot('01-accueil');
    await step('02-nouveau-site', async (p) => {
      await p.click('[data-testid="new-site"]');
      await p.waitForTimeout(2500);
    });
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/sites/${SITE}`);
    await page.waitForSelector('[data-testid="layers-panel"]', { timeout: 60000 });
    await page.waitForTimeout(5000);
    await shot('03-espace');
    await step('04-couche', async (p) => {
      await p.locator('[data-testid="layer-item"]').nth(2).click();
      await p.click('[data-testid="tab-right-couche"]');
    });
    await step('05-couche-bas', async (p) => {
      await p.locator('[data-testid="right-panel"] .overflow-y-auto').first().evaluate((e) => e.scrollTo(0, 600));
    });
    for (const t of await page.locator('[data-testid^="tab-right-"]').all()) {
      const id = (await t.getAttribute('data-testid'))!.replace('tab-right-', '');
      if (id === 'couche') continue;
      await step(`06-onglet-${id}`, async () => {
        await t.click();
      });
    }
    await step('07-fonds', async (p) => {
      await p.click('[data-testid="basemap-button"]');
    });
    await page.keyboard.press('Escape');
    await page.mouse.click(700, 500);
    await step('08-collecte', async (p) => {
      await p.click('[data-testid="collect-open"]');
      await p.waitForTimeout(800);
    });
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/sites/${SITE}`);
    await page.waitForSelector('[data-testid="layers-panel"]', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await step('09-table', async (p) => {
      await p.locator('[data-testid="layer-item"]').nth(2).hover();
      await p.locator('[data-testid="layer-item"]').nth(2).getByTitle('Table attributaire').click();
      await p.waitForTimeout(500);
    });
    await page.keyboard.press('Escape');
    await step('11-palette', async (p) => {
      await p.keyboard.press('Control+k');
      await p.getByTestId('command-input').fill('bat');
    });
    await page.keyboard.press('Escape');
    await step('12-raccourcis', async (p) => {
      await p.keyboard.press('?');
      await p.getByTestId('shortcuts-dialog').waitFor();
    });
    await page.keyboard.press('Escape');
    await step('13-outil', async (p) => {
      await p.click('[data-testid="tool-draw-polygon"]');
      await p.mouse.move(700, 400);
    });
    await page.keyboard.press('Escape');
    await step('14-clic-droit', async (p) => {
      await p.mouse.click(700, 400, { button: 'right' });
      await p.getByTestId('map-menu').waitFor();
    });
    await page.keyboard.press('Escape');
    await step('15-export', async (p) => {
      await p.click('[data-testid="export-menu"]');
    });
    await page.keyboard.press('Escape');
    await step('10-mise-en-page', async (p) => {
      await p.click('[data-testid="layout-open"]');
      await p.waitForSelector('[data-testid="layout-editor"]');
      await p.waitForTimeout(9000);
    });
    await ctx.close();
  }
  // petit écran (portable 1280×720)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sites/${SITE}`);
  await page.waitForSelector('[data-testid="layers-panel"]', { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, 'petit-03-espace.png') });
  await browser.close();
  if (errors.length) console.log(`Erreurs :\n${[...new Set(errors)].join('\n')}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
