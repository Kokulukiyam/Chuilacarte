import 'server-only';
import { jsonError } from './storage';

export function handle<A extends any[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      return jsonError(e);
    }
  };
}

export type Ctx<P> = { params: Promise<P> };
