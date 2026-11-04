import type { FilterRule } from './types';

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function matchRule(props: Record<string, any>, r: FilterRule): boolean {
  const v = props?.[r.field];
  switch (r.op) {
    case 'exists':
      return v !== undefined && v !== null && v !== '';
    case '=':
      return String(v ?? '') === r.value;
    case '!=':
      return String(v ?? '') !== r.value;
    case 'contains':
      return String(v ?? '').toLowerCase().includes(r.value.toLowerCase());
    default: {
      const a = num(v);
      const b = num(r.value);
      if (a === null || b === null) return false;
      if (r.op === '>') return a > b;
      if (r.op === '>=') return a >= b;
      if (r.op === '<') return a < b;
      if (r.op === '<=') return a <= b;
      return false;
    }
  }
}

export function matchAll(props: Record<string, any>, rules: FilterRule[] | undefined): boolean {
  if (!rules || !rules.length) return true;
  return rules.every((r) => !r.field || matchRule(props, r));
}

export const OP_LABELS: Record<FilterRule['op'], string> = {
  '=': 'égal à',
  '!=': 'différent de',
  '>': 'supérieur à',
  '>=': 'supérieur ou égal à',
  '<': 'inférieur à',
  '<=': 'inférieur ou égal à',
  contains: 'contient',
  exists: 'est renseigné',
};
