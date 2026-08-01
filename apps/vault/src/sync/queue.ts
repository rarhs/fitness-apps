import type { SyncBackend, SyncOp } from './types';

const KINDS: SyncOp['kind'][] = ['push-session', 'put-routine', 'put-profile', 'put-saved'];

function dispatch(backend: SyncBackend, op: SyncOp): Promise<void> {
  switch (op.kind) {
    case 'push-session':
      return backend.pushSessions([op.session]);
    case 'put-routine':
      return backend.putRoutine(op.routine);
    case 'put-profile':
      return backend.putProfile(op.profile);
    case 'put-saved':
      return backend.putSaved(op.saved);
  }
}

/** Offline write buffer. Writes queue here first and are replayed FIFO against
 * the backend; a failure keeps the failed op and everything after it for the
 * next flush. Document-style ops (profile/saved) coalesce to the latest value;
 * session pushes coalesce by session id, routine puts by routine id. */
export class SyncQueue {
  #ops: SyncOp[];

  constructor(ops: SyncOp[] = []) {
    this.#ops = [...ops];
  }

  ops(): SyncOp[] {
    return [...this.#ops];
  }

  enqueue(op: SyncOp): void {
    this.#ops = this.#ops.filter((existing) => {
      if (op.kind === 'push-session') {
        return !(existing.kind === 'push-session' && existing.session.id === op.session.id);
      }
      if (op.kind === 'put-routine') {
        return !(existing.kind === 'put-routine' && existing.routine.id === op.routine.id);
      }
      return existing.kind !== op.kind;
    });
    this.#ops.push(op);
  }

  async flush(backend: SyncBackend): Promise<{ flushed: number; remaining: number }> {
    let flushed = 0;
    while (this.#ops.length > 0) {
      try {
        await dispatch(backend, this.#ops[0]!);
      } catch {
        break;
      }
      this.#ops.shift();
      flushed += 1;
    }
    return { flushed, remaining: this.#ops.length };
  }

  serialize(): string {
    return JSON.stringify(this.#ops);
  }

  static deserialize(raw: string | null): SyncQueue {
    if (!raw) return new SyncQueue();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new SyncQueue();
      return new SyncQueue(
        parsed.filter(
          (op): op is SyncOp =>
            typeof op === 'object' && op !== null && KINDS.includes((op as SyncOp).kind),
        ),
      );
    } catch {
      return new SyncQueue();
    }
  }
}
