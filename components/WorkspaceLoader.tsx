'use client';
import dynamic from 'next/dynamic';

const Workspace = dynamic(() => import('./Workspace'), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center text-zinc-500">Chargement de l’espace de travail…</div>,
});

export default function WorkspaceLoader({ slug }: { slug: string }) {
  return <Workspace slug={slug} />;
}
