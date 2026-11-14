'use client';
import { X } from 'lucide-react';
import { TOOL_KEYS } from '@/lib/shortcuts';
import { TOOL_LABELS } from './toolbarTools';
import { useEscape } from './ui/hooks';

function Row({ label, keys }: { label: string; keys: string[] }) {
  return (
    <li className="flex items-center justify-between gap-3 py-[3px]">
      <span className="truncate">{label}</span>
      <span className="flex shrink-0 gap-1">
        {keys.map((k) => (
          <span key={k} className="kbd">
            {k}
          </span>
        ))}
      </span>
    </li>
  );
}

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const mod = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const tools = Object.entries(TOOL_KEYS);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Raccourcis clavier" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-testid="shortcuts-dialog">
      <div className="modal w-[min(680px,96vw)]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="font-display text-[17px] font-bold">Raccourcis clavier</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-x-8 gap-y-4 overflow-y-auto px-5 py-4 text-[12.5px] sm:grid-cols-2">
          <section>
            <div className="section-title mb-1.5">Outils</div>
            <ul>
              {tools.map(([k, t]) => (
                <Row key={k} label={TOOL_LABELS[t] || t} keys={[k.toUpperCase()]} />
              ))}
            </ul>
          </section>
          <div className="space-y-4">
            <section>
              <div className="section-title mb-1.5">Général</div>
              <ul>
                <Row label="Rechercher une commande" keys={[mod, 'K']} />
                <Row label="Annuler" keys={[mod, 'Z']} />
                <Row label="Rétablir" keys={[mod, 'Maj', 'Z']} />
                <Row label="Revenir à la sélection, fermer" keys={['Échap']} />
                <Row label="Supprimer l’objet sélectionné" keys={['Suppr']} />
                <Row label="Cette aide" keys={['?']} />
              </ul>
            </section>
            <section>
              <div className="section-title mb-1.5">Affichage</div>
              <ul>
                <Row label="Vue 3D" keys={['3']} />
                <Row label="Recadrer sur le site" keys={['0']} />
              </ul>
            </section>
            <section>
              <div className="section-title mb-1.5">Sur la carte</div>
              <ul>
                <Row label="Sélection multiple (fusion)" keys={['Maj', 'clic']} />
                <Row label="Tourner et incliner" keys={['Ctrl', 'glisser']} />
                <Row label="Coordonnées, recadrage" keys={['clic droit']} />
                <Row label="Zoomer sur une couche" keys={['double-clic']} />
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
