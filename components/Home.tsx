'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Copy, MapPin, Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { SiteSummary } from '@/lib/types';
import { isDark, setTheme } from '@/lib/theme';

const NewSiteDialog = dynamic(() => import('./NewSiteDialog'), { ssr: false });

export default function Home() {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dark, setDark] = useState(false);

  const load = () =>
    api<SiteSummary[]>('/api/sites')
      .then(setSites)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    setDark(isDark());
  }, []);

  const rename = async (s: SiteSummary) => {
    const name = prompt('Nouveau nom du site', s.name);
    if (!name || name === s.name) return;
    await api(`/api/sites/${s.slug}`, { method: 'PATCH', json: { name } }).catch((e) => alert(e.message));
    load();
  };
  const duplicate = async (s: SiteSummary) => {
    await api(`/api/sites/${s.slug}/duplicate`, { method: 'POST', json: {} }).catch((e) => alert(e.message));
    load();
  };
  const remove = async (s: SiteSummary) => {
    if (!confirm(`Supprimer définitivement le site « ${s.name} » et toutes ses couches ?`)) return;
    await api(`/api/sites/${s.slug}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    load();
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <MapPin size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Chuilacarte</h1>
            <p className="text-xs text-zinc-500">Préparer un site, collecter les données, faire une belle carte</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            title="Mode sombre"
            onClick={() => {
              setTheme(!dark);
              setDark(!dark);
            }}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn-primary" onClick={() => setCreating(true)} data-testid="new-site">
            <Plus size={16} /> Nouveau site
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-8 py-8">
        <h2 className="section-title mb-4">Mes sites</h2>
        {error && <p className="text-red-600">{error}</p>}
        {sites && sites.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700">
            <p className="mb-4">Aucun site pour l’instant.</p>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Créer un premier site
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sites?.map((s) => (
            <div key={s.slug} className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900" data-testid="site-card">
              <Link href={`/sites/${s.slug}`} className="block">
                <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800">
                  {s.hasThumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/sites/${s.slug}/thumbnail?t=${encodeURIComponent(s.updatedAt)}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <MapPin size={32} />
                    </div>
                  )}
                </div>
                <div className="px-4 pt-3">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-zinc-500">
                    {s.layerCount} couche{s.layerCount > 1 ? 's' : ''} · modifié le {new Date(s.updatedAt).toLocaleDateString('fr-FR')} ·{' '}
                    {s.center[1].toFixed(4)}, {s.center[0].toFixed(4)}
                  </div>
                </div>
              </Link>
              <div className="flex gap-1 px-3 pb-3 pt-2 opacity-70 group-hover:opacity-100">
                <button className="btn-ghost" onClick={() => rename(s)} title="Renommer">
                  <Pencil size={14} /> Renommer
                </button>
                <button className="btn-ghost" onClick={() => duplicate(s)} title="Dupliquer">
                  <Copy size={14} /> Dupliquer
                </button>
                <button className="btn-ghost ml-auto text-red-600 dark:text-red-400" onClick={() => remove(s)} title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
      {creating && <NewSiteDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
