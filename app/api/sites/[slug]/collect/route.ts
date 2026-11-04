import * as turf from '@turf/turf';
import { COLLECTORS } from '@/lib/server/collect';
import { readSite, writeLayer } from '@/lib/server/storage';
import { bufferedEmprise, siteBBox } from '@/lib/site';
import type { CollectReportItem } from '@/lib/types';
import { handle, type Ctx } from '@/lib/server/route';

export const runtime = 'nodejs';
export const maxDuration = 900;

/**
 * Lance la collecte et renvoie un flux NDJSON d'événements :
 * {type:'log', source, message} · {type:'layer', layer} · {type:'item', item} · {type:'done', report}
 * Les couches sont écrites sur disque ; c'est le client qui les ajoute à site.json (évite les écritures concurrentes).
 */
export const POST = handle(async (req: Request, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const body = await req.json().catch(() => ({}));
  const wanted: string[] = Array.isArray(body.sources) && body.sources.length ? body.sources : COLLECTORS.filter((c) => c.defaultOn !== false).map((c) => c.id);
  const area = bufferedEmprise(site);
  const bbox = siteBBox(site);
  const km2 = turf.area(area) / 1e6;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: any) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
        } catch {
          /* client parti */
        }
      };
      const items: CollectReportItem[] = [];
      send({ type: 'log', source: 'collecte', message: `Emprise de collecte : ${km2.toFixed(2)} km²` });
      // les sources sont indépendantes : on les lance en parallèle (une requête à la fois par serveur)
      await Promise.all(
        COLLECTORS.filter((c) => wanted.includes(c.id)).map(async (c) => {
          const t0 = Date.now();
          send({ type: 'start', source: c.id, label: c.label });
          try {
            if (c.maxAreaKm2 && km2 > c.maxAreaKm2) throw new Error(`emprise trop grande (${km2.toFixed(1)} km² > ${c.maxAreaKm2} km²)`);
            const res = await c.run({ site, bbox, area, slug, log: (m) => send({ type: 'log', source: c.id, message: m }) });
            for (const l of res.layers) {
              if (l.fc) await writeLayer(slug, l.id, l.fc);
              const count = l.fc ? l.fc.features.length : 1;
              const { fc: _fc, ...meta } = l;
              send({ type: 'layer', source: c.id, layer: { ...meta, count } });
              const it: CollectReportItem = { source: c.label, layer: l.name, count, ok: true, ms: Date.now() - t0 };
              items.push(it);
              send({ type: 'item', item: it });
            }
            for (const n of res.notes || []) send({ type: 'note', source: c.id, message: n });
            if (res.notes?.length) items.push({ source: c.label, layer: res.notes.join(' · '), count: 0, ok: true, ms: Date.now() - t0 });
          } catch (e: any) {
            console.error(`[collecte ${c.id}]`, e);
            const it: CollectReportItem = { source: c.label, count: 0, ok: false, error: String(e?.message || e), ms: Date.now() - t0 };
            items.push(it);
            send({ type: 'item', item: it });
          }
        }),
      );
      send({ type: 'done', report: { date: new Date().toISOString(), items } });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
});
