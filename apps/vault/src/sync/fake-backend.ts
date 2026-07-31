import type { Profile, Routine, SessionRecord } from '../state';
import type { RemoteState, SyncBackend } from './types';

/** In-memory SyncBackend for tests: records every call in order and can be
 * told to fail specific calls by 1-based call number. Not shipped — only test
 * code imports it. */
export class FakeBackend implements SyncBackend {
  state: RemoteState = { sessions: [], routine: null, profile: null, saved: [] };
  calls: string[] = [];
  /** 1-based call numbers (across all methods) that should throw. */
  failOnCalls: number[] = [];
  private callCount = 0;

  private touch(name: string): void {
    this.callCount += 1;
    this.calls.push(name);
    if (this.failOnCalls.includes(this.callCount)) {
      throw new Error(`backend down (call ${this.callCount}: ${name})`);
    }
  }

  async fetchState(): Promise<RemoteState> {
    this.touch('fetchState');
    return structuredClone(this.state);
  }

  async pushSessions(sessions: SessionRecord[]): Promise<void> {
    this.touch('pushSessions');
    for (const s of sessions) {
      const i = this.state.sessions.findIndex((r) => r.id === s.id);
      if (i >= 0) this.state.sessions[i] = s;
      else this.state.sessions.push(s);
    }
  }

  async putRoutine(routine: Routine): Promise<void> {
    this.touch('putRoutine');
    this.state.routine = routine;
  }

  async putProfile(profile: Profile): Promise<void> {
    this.touch('putProfile');
    this.state.profile = profile;
  }

  async putSaved(saved: string[]): Promise<void> {
    this.touch('putSaved');
    this.state.saved = [...saved];
  }
}
