import type { SyncBackend, SyncOp } from './types';

/** Offline write buffer. Writes queue here first and are replayed FIFO against
 * the backend; a failure keeps the failed op and everything after it for the
 * next flush. Document-style ops (routine/profile/saved) coalesce to the
 * latest value; session pushes coalesce by session id. */
export class SyncQueue {
  constructor(ops: SyncOp[] = []) {
    void ops;
    throw new Error('not implemented');
  }

  ops(): SyncOp[] {
    throw new Error('not implemented');
  }

  enqueue(op: SyncOp): void {
    void op;
    throw new Error('not implemented');
  }

  flush(backend: SyncBackend): Promise<{ flushed: number; remaining: number }> {
    void backend;
    throw new Error('not implemented');
  }

  serialize(): string {
    throw new Error('not implemented');
  }

  static deserialize(raw: string | null): SyncQueue {
    void raw;
    throw new Error('not implemented');
  }
}
