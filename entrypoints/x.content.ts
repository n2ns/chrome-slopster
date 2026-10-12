import { xAdapter } from '@/src/adapters/x';
import { runContentScript } from '@/src/content-core';

export default defineContentScript({
  matches: xAdapter.matches,
  runAt: 'document_idle',
  main(ctx) {
    runContentScript(xAdapter, ctx);
  },
});
