import { execute } from './registry';
import { demoProvider } from './advanced-helpers';
self.onmessage = (event: MessageEvent) => {
  const { id, name, args, context } = event.data;
  try {
    self.postMessage({
      id,
      result: execute(name, args, { ...context, providers: { demo: demoProvider } }),
    });
  } catch (e) {
    self.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
};
