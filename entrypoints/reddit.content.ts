import { redditAdapter } from '@/src/adapters/reddit';
import { runContentScript } from '@/src/content-core';

export default defineContentScript({
  matches: redditAdapter.matches,
  runAt: 'document_idle',
  main(ctx) {
    runContentScript(redditAdapter, ctx);
  },
});
