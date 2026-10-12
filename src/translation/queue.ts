// Caps how many translations run at once and staggers their start by a small
// random delay, so a burst of requests does not trip the services' rate limits.

export interface QueueOptions {
  concurrency: number;
  minStaggerMs: number;
  maxStaggerMs: number;
}

export type Enqueue = <T>(task: () => Promise<T>) => Promise<T>;

interface QueueItem {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export function createQueue({ concurrency, minStaggerMs, maxStaggerMs }: QueueOptions): Enqueue {
  const pending: QueueItem[] = [];
  let active = 0;

  function drain(): void {
    while (active < concurrency && pending.length > 0) {
      const item = pending.shift()!;
      active += 1;
      const stagger = minStaggerMs + Math.floor(Math.random() * (maxStaggerMs - minStaggerMs + 1));
      setTimeout(() => {
        // Run the task inside .then() so a synchronous throw becomes a rejection;
        // otherwise finally() would never run and the slot would leak forever.
        Promise.resolve()
          .then(() => item.task())
          .then(item.resolve, item.reject)
          .finally(() => {
            active -= 1;
            drain();
          });
      }, stagger);
    }
  }

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      pending.push({ task, resolve: resolve as (value: unknown) => void, reject });
      drain();
    });
}

/** The queue every translation request goes through. */
export const enqueueTranslation = createQueue({ concurrency: 3, minStaggerMs: 40, maxStaggerMs: 80 });
