'use client';
export async function api<T = any>(url: string, init?: RequestInit & { json?: any }): Promise<T> {
  const opts: RequestInit = { ...init };
  if (init?.json !== undefined) {
    opts.body = JSON.stringify(init.json);
    opts.headers = { 'content-type': 'application/json', ...(init.headers || {}) };
  }
  const r = await fetch(url, opts);
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error((body && (body as any).error) || `Erreur ${r.status}`);
  return body as T;
}
