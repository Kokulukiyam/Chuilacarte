import 'server-only';

export function userAgent() {
  const contact = process.env.CONTACT_EMAIL ? ` (${process.env.CONTACT_EMAIL})` : '';
  return `Chuilacarte/0.1 outil cartographique personnel${contact}`;
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeout?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeout ?? 30000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': userAgent(), ...(init.headers || {}) } });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`délai dépassé (${Math.round((init.timeout ?? 30000) / 1000)} s)`);
    throw new Error(e?.cause?.code || e?.message || String(e));
  } finally {
    clearTimeout(t);
  }
}

/** File d'attente simple pour respecter un débit max (ex. Nominatim : 1 requête/s). */
export function rateLimiter(minIntervalMs: number) {
  let last = 0;
  let chain: Promise<void> = Promise.resolve();
  return () => {
    const p = chain.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
    });
    chain = p.catch(() => {});
    return p;
  };
}
