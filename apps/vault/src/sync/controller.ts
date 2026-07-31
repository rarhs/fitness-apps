import type { Persisted } from '../state';
import { mergeStates } from './merge';
import { opsForTransition, planOps } from './ops';
import { SyncQueue } from './queue';
import type { SyncBackend } from './types';

/** Orchestrates one signed-in device against one backend: an initial
 * fetch → merge → push-plan, then incremental ops for every state change,
 * all funnelled through the offline SyncQueue. Framework-free — the React
 * provider is a thin adapter. flush() never throws; failed ops stay queued
 * for the next flush (change, reconnect or interval). */
export class SyncController {
  #backend: SyncBackend;
  #queue: SyncQueue;
  #lastSynced: Persisted | null = null;

  constructor(backend: SyncBackend, queue: SyncQueue = new SyncQueue()) {
    this.#backend = backend;
    this.#queue = queue;
  }

  /** Fetch the remote state and reconcile. `getLocal` is read after the fetch
   * resolves so edits made during the round-trip are not lost. Returns the
   * merged state for the caller to hydrate into the app. Rejects when the
   * fetch fails — call again to retry; nothing is consumed on failure. */
  async start(getLocal: () => Persisted): Promise<Persisted> {
    const remote = await this.#backend.fetchState();
    const { merged, push } = mergeStates(getLocal(), remote);
    this.#lastSynced = merged;
    for (const op of planOps(merged, push)) this.#queue.enqueue(op);
    await this.flush();
    return merged;
  }

  /** Enqueue and push whatever `next` changed since the last synced state.
   * A no-op before start() succeeds — those edits are folded into the merge. */
  async onChange(next: Persisted): Promise<void> {
    if (this.#lastSynced === null) return;
    const ops = opsForTransition(this.#lastSynced, next);
    this.#lastSynced = next;
    for (const op of ops) this.#queue.enqueue(op);
    if (ops.length > 0) await this.flush();
  }

  async flush(): Promise<void> {
    await this.#queue.flush(this.#backend);
  }

  pending(): number {
    return this.#queue.ops().length;
  }

  serializeQueue(): string {
    return this.#queue.serialize();
  }
}
