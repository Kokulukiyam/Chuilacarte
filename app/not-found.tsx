import Link from 'next/link';
import Logo from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={40} />
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Cette page n’est pas sur la carte</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">L’adresse demandée n’existe pas, ou le site a été supprimé.</p>
      </div>
      <Link href="/" className="btn-primary">
        Retour à mes sites
      </Link>
    </div>
  );
}
