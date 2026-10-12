import { facebookAdapter } from '@/src/adapters/facebook';
import { runContentScript } from '@/src/content-core';

export default defineContentScript({
  matches: facebookAdapter.matches,
  runAt: 'document_idle',
  main(ctx) {
    runContentScript(facebookAdapter, ctx);
  },
});
