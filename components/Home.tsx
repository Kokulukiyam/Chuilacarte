'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Copy, DownloadCloud, Layers, MapPin, Moon, Pencil, Plus, Printer, Search, SquareDashed, Sun, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { SiteSummary } from '@/lib/types';
import { isDark, setTheme } from '@/lib/theme';
import { askConfirm, askText } from '@/lib/dialogs';
import { useStore } from '@/lib/store';
import Dialogs from './ui/Dialogs';
import Tooltips from './ui/Tooltips';
import Toast from './Toast';
import Logo from './ui/Logo';
import { relativeDate } from './ui/hooks';

const NewSiteDialog = dynamic(() => import('./NewSiteDialog'), { ssr: false });

type Sort = 'recent' | 'name';

export default function Home() {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dark, setDark] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const toast = useStore((s) => s.toast);

  const load = () =>
    api<SiteSummary[]>('/api/sites')
      .then((s) => {
        setSites(s);
        setError(null);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    setDark(isDark());
    document.title = 'Chuilacarte';
  }, []);

  const rename = async (s: SiteSummary) => {
    const name = await askText('Renommer le site', { label: 'Nom du site', initial: s.name, okLabel: 'Renommer' });
    if (!name || name === s.name) return;
    await api(`/api/sites/${s.slug}`, { method: 'PATCH', json: { name } }).catch((e) => toast(e.message, 'error'));
    load();
  };
  const duplicate = async (s: SiteSummary) => {
    await api(`/api/sites/${s.slug}/duplicate`, { method: 'POST', json: {} })
      .then(() => toast(`« ${s.name} » dupliqué`, 'ok'))
      .catch((e) => toast(e.message, 'error'));
    load();
  };
  const remove = async (s: SiteSummary) => {
    const ok = await askConfirm(`Supprimer « ${s.name} » ?`, {
      message: 'Le site, ses couches, ses mises en page et ses exports seront supprimés définitivement du disque.',
      okLabel: 'Supprimer le site',
      danger: true,
    });
    if (!ok) return;
    await api(`/api/sites/${s.slug}`, { method: 'DELETE' })
      .then(() => toast(`« ${s.name} » supprimé`, 'info'))
      .catch((e) => toast(e.message, 'error'));
    load();
  };

  const shown = useMemo(() => {
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const r = (sites || []).filter((s) => norm(s.name).includes(norm(q.trim())));
    return sort === 'name' ? [...r].sort((a, b) => a.name.localeCompare(b.name, 'fr')) : r;
  }, [sites, q, sort]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-3">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <div>
              <h1 className="font-display text-[19px] font-bold leading-tight tracking-tight">Chuilacarte</h1>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Préparer un site, collecter les données, faire une belle carte</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="icon-btn"
              data-tip={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
              aria-label="Mode sombre"
              onClick={() => {
                setTheme(!dark);
                setDark(!dark);
              }}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="btn-accent" onClick={() => setCreating(true)} data-testid="new-site">
              <Plus size={16} /> Nouveau site
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-8">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" role="alert">
            <span>Impossible de charger les sites : {error}</span>
            <button className="btn" onClick={load}>
              Réessayer
            </button>
          </div>
        )}

        {!sites && !error && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-[16/10] rounded-none" />
                <div className="space-y-2 p-4">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {sites && sites.length === 0 && (
          <div className="mx-auto max-w-2xl py-10 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
              <MapPin size={26} />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Commencez par un site d’étude</h2>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Un site, c’est une emprise sur la carte. Chuilacarte y rassemble les données ouvertes, vos dessins et vos analyses, puis en tire des planches prêtes à imprimer.
            </p>
            <button className="btn-accent mt-6 px-4 py-2 text-[14px]" onClick={() => setCreating(true)}>
              <Plus size={16} /> Créer un premier site
            </button>
            <ol className="mt-10 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
              {(
                [
                  [SquareDashed, 'Délimiter', 'Cherchez un lieu, dessinez l’emprise ou importez un fichier.'],
                  [DownloadCloud, 'Collecter', 'Bâti, voirie, relief, population, imagerie : en un clic.'],
                  [Printer, 'Mettre en page', 'Planches à l’échelle, en PNG 300 dpi, PDF ou SVG.'],
                ] as const
              ).map(([I, t, d], i) => (
                <li key={t} className="card p-4">
                  <div className="mb-2 flex items-center gap-2 text-zinc-500">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">{i + 1}</span>
                    <I size={15} />
                  </div>
                  <div className="font-semibold">{t}</div>
                  <p className="hint mt-0.5">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {sites && sites.length > 0 && (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[22px] font-bold leading-tight tracking-tight">Mes sites</h2>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  {sites.length} site{sites.length > 1 ? 's' : ''} d’étude{q.trim() && ` · ${shown.length} trouvé${shown.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input className="input w-56 py-1.5 pl-8 pr-7" placeholder="Rechercher un site…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un site" data-testid="site-search" />
                  {q && (
                    <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100" onClick={() => setQ('')} aria-label="Effacer la recherche">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <select className="input w-auto py-1.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier les sites">
                  <option value="recent">Modifiés récemment</option>
                  <option value="name">Par nom</option>
                </select>
              </div>
            </div>

            {shown.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
                Aucun site ne correspond à « {q} ».{' '}
                <button className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-300" onClick={() => setQ('')}>
                  Tout afficher
                </button>
              </p>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((s) => (
                <div
                  key={s.slug}
                  className="card group relative overflow-hidden shadow-[0_1px_2px_rgb(28_25_22/0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-pop dark:hover:border-zinc-700"
                  data-testid="site-card"
                >
                  <Link href={`/sites/${s.slug}`} className="block" aria-label={`Ouvrir ${s.name}`}>
                    <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      {s.hasThumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/sites/${s.slug}/thumbnail?t=${encodeURIComponent(s.updatedAt)}`} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-400">
                          <MapPin size={28} />
                          <span className="text-[11px]">Aperçu à la première ouverture</span>
                        </div>
                      )}
                      <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-zinc-900/85 px-2.5 py-1 text-[11.5px] font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                        Ouvrir <ArrowUpRight size={12} />
                      </span>
                    </div>
                    <div className="px-4 pb-1 pt-3">
                      <div className="truncate text-[14px] font-semibold" title={s.name}>
                        {s.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                        <Layers size={11} />
                        {s.layerCount} couche{s.layerCount > 1 ? 's' : ''}
                        <span aria-hidden>·</span>
                        <span title={new Date(s.updatedAt).toLocaleString('fr-FR')}>modifié {relativeDate(s.updatedAt)}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-0.5 px-2.5 pb-2.5 pt-1">
                    <span className="mr-auto pl-1.5 font-mono text-[10.5px] text-zinc-400" title="Latitude, longitude du centre">
                      {s.center[1].toFixed(4).replace('.', ',')}° {s.center[0].toFixed(4).replace('.', ',')}°
                    </span>
                    <button className="icon-btn" onClick={() => rename(s)} aria-label="Renommer" data-tip="Renommer">
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => duplicate(s)} aria-label="Dupliquer" data-tip="Dupliquer">
                      <Copy size={14} />
                    </button>
                    <button className="icon-btn hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950" onClick={() => remove(s)} aria-label="Supprimer" data-tip="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {!q.trim() && (
                <button
                  className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 text-zinc-500 transition hover:border-accent-500 hover:bg-accent-50/50 hover:text-accent-700 dark:border-zinc-700 dark:hover:border-accent-400 dark:hover:bg-accent-900/10 dark:hover:text-accent-300"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={22} />
                  <span className="font-medium">Nouveau site</span>
                </button>
              )}
            </div>
          </>
        )}
      </main>
      {creating && <NewSiteDialog onClose={() => setCreating(false)} />}
      <Dialogs />
      <Tooltips />
      <Toast />
    </div>
  );
}
