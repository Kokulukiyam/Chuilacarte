'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialogs, type DialogRequest } from '@/lib/dialogs';

function Dialog({ r }: { r: DialogRequest }) {
  const close = useDialogs((s) => s.close);
  const [value, setValue] = useState(r.initial ?? '');
  const input = useRef<HTMLInputElement>(null);
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (r.kind === 'prompt') {
      input.current?.focus();
      input.current?.select();
    } else ok.current?.focus();
  }, [r.kind]);
  const cancel = () => close(r.id, r.kind === 'confirm' ? false : null);
  const valid = r.kind !== 'prompt' || r.allowEmpty || value.trim() !== '';
  const submit = () => {
    if (!valid) return;
    close(r.id, r.kind === 'prompt' ? value.trim() : true);
  };
  return (
    <div
      className="modal-backdrop z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label={r.title}
      data-testid="dialog"
      onMouseDown={(e) => e.target === e.currentTarget && cancel()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') cancel();
      }}
    >
      <form
        className="modal w-full max-w-sm p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-start gap-3">
          {r.danger && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertTriangle size={16} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold leading-snug">{r.title}</h2>
            {r.message && <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">{r.message}</p>}
          </div>
        </div>
        {r.kind === 'prompt' && (
          <div className="mt-3">
            {r.label && <label className="label">{r.label}</label>}
            <input ref={input} className="input py-1.5" value={value} placeholder={r.placeholder} onChange={(e) => setValue(e.target.value)} data-testid="dialog-input" />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {r.kind !== 'alert' && (
            <button type="button" className="btn" onClick={cancel} data-testid="dialog-cancel">
              {r.cancelLabel || 'Annuler'}
            </button>
          )}
          <button ref={ok} type="submit" className={r.danger ? 'btn-danger-solid' : 'btn-primary'} disabled={!valid} data-testid="dialog-ok">
            {r.okLabel || (r.kind === 'alert' ? 'Compris' : r.kind === 'confirm' ? 'Confirmer' : 'Valider')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** À monter une fois par page : affiche la boîte de dialogue en attente. */
export default function Dialogs() {
  const r = useDialogs((s) => s.queue[0]);
  if (!r) return null;
  return <Dialog key={r.id} r={r} />;
}
