import { importFile } from './io';
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ id: data.id, preview: await importFile(data.file, data.options) });
  } catch (e) {
    self.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
  }
};
