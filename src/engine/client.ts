import type { CalcContext, CalculationResult } from './types';
let worker: Worker | undefined;
const pending = new Map<
  string,
  {
    resolve: (r: CalculationResult) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export function calculateAsync(
  name: string,
  args: Record<string, any>,
  context: CalcContext,
): Promise<CalculationResult> {
  if (!worker) {
    worker = new Worker(new URL('./calculation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (p) {
        clearTimeout(p.timer);
        data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
        pending.delete(data.id);
      }
    };
    worker.onerror = () => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('Calculation worker stopped. Please retry.'));
      }
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('Calculation exceeded the 30 second limit. Use a smaller range.'));
      }
      pending.clear();
      worker?.terminate();
      worker = undefined;
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, name, args, context });
  });
}
