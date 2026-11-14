/** Marque de l'application : courbes de niveau dans un carré d'encre, point de site en terre cuite. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="7" className="fill-zinc-900 dark:fill-zinc-100" />
      <g fill="none" strokeLinecap="round" strokeWidth="1.5" className="stroke-zinc-400 dark:stroke-zinc-500">
        <path d="M4 21c4-5 7 1 11-3s6-9 13-7" opacity=".55" />
        <path d="M4 26c5-4 8 1 12-2s7-8 12-7" opacity=".9" />
        <path d="M4 15c3-4 6-1 9-4s4-6 9-6" opacity=".3" />
      </g>
      <circle cx="19" cy="13" r="3.4" className="fill-accent-500" />
      <circle cx="19" cy="13" r="1.2" className="fill-white dark:fill-zinc-100" />
    </svg>
  );
}
