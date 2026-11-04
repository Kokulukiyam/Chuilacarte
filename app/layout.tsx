import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chuilacarte',
  description: 'Plateforme cartographique personnelle pour l’architecture et l’urbanisme',
};

const themeScript = `try{var t=localStorage.getItem('chuilacarte-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
