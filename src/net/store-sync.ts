import type { SaveSystem } from '../core/save';
import { api } from './api';
import { applyCloudToSave } from './protocol';

const PENDING_KEY = 'vanguarda.pendingPurchase.v1';
const POLL_MS = 4_000;
// Pix QR codes expire in well under this; the margin covers a slow bank transfer
// plus webhook delivery lag before we give up and call it expired.
const MAX_TRACK_MS = 20 * 60 * 1000;

type Resolution = 'approved' | 'rejected' | 'expired';

interface Pending {
  purchaseId: string;
  startedAt: number;
}

/**
 * Tracks a pending coin purchase across reloads. `api/save.ts` treats `coins`
 * as client-authoritative on every push — so if the webhook credits coins on
 * the server while the client's local save is still stale, the next ordinary
 * save push (triggered by literally any persist(), e.g. finishing a run)
 * would overwrite the server's higher balance right back down. Polling here
 * and adopting the result via applyCloudToSave+persist() the moment payment
 * is confirmed closes that window, whether or not the store screen is open.
 *
 * Every poll loop is scoped to the specific purchaseId it's chasing (`activeId`).
 * This matters when a player buys a second pack before the first one's poll
 * tick has caught up to its approval: track() immediately cancels the old
 * timer and takes over `activeId`, so when the first tick's in-flight
 * request resolves, it sees it's been superseded and does nothing — it can
 * no longer wipe the second purchase's localStorage entry or stop its
 * tracking. (An earlier version got this wrong: a single `polling` boolean
 * plus an unconditional clear() meant the first purchase's late-arriving
 * "approved" response would delete the second purchase's tracking record,
 * silently orphaning it even though the server had already credited it.)
 */
class StoreSync {
  private save: SaveSystem | null = null;
  private timer: number | null = null;
  private activeId: string | null = null;
  private readonly listeners = new Set<(status: Resolution) => void>();

  init(save: SaveSystem): void {
    this.save = save;
    const pending = this.read();
    if (pending) this.poll(pending.purchaseId);
  }

  onResolve(cb: (status: Resolution) => void): void {
    this.listeners.add(cb);
  }

  offResolve(cb: (status: Resolution) => void): void {
    this.listeners.delete(cb);
  }

  track(purchaseId: string): void {
    this.write({ purchaseId, startedAt: Date.now() });
    this.poll(purchaseId);
  }

  /** True while a purchase started on this device is still awaiting confirmation. */
  get isTracking(): boolean {
    return this.read() !== null;
  }

  private poll(purchaseId: string): void {
    if (this.activeId === purchaseId) return; // already the one being chased
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.activeId = purchaseId;

    const tick = async (): Promise<void> => {
      if (this.activeId !== purchaseId) return; // superseded by a newer purchase mid-flight

      const pending = this.read();
      if (!pending || pending.purchaseId !== purchaseId) {
        if (this.activeId === purchaseId) this.activeId = null;
        return;
      }
      if (Date.now() - pending.startedAt > MAX_TRACK_MS) {
        this.resolveAs(purchaseId, 'expired');
        return;
      }

      try {
        const res = await api.purchaseStatus(purchaseId);
        if (this.activeId !== purchaseId) return; // superseded while the request was in flight

        if (res.status === 'approved') {
          if (res.save && this.save) {
            applyCloudToSave(this.save.data, res.save);
            this.save.persist();
          }
          this.resolveAs(purchaseId, 'approved');
          return;
        }
        if (res.status === 'rejected' || res.status === 'expired') {
          this.resolveAs(purchaseId, res.status);
          return;
        }
      } catch {
        // offline or a server hiccup — keep polling, same posture as sync.ts
      }

      if (this.activeId === purchaseId) {
        this.timer = window.setTimeout(() => void tick(), POLL_MS);
      }
    };
    void tick();
  }

  private resolveAs(purchaseId: string, status: Resolution): void {
    if (this.activeId === purchaseId) this.activeId = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.clearIfMatches(purchaseId);
    this.notify(status);
  }

  private notify(status: Resolution): void {
    for (const cb of this.listeners) cb(status);
  }

  private read(): Pending | null {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? (JSON.parse(raw) as Pending) : null;
    } catch {
      return null;
    }
  }

  private write(p: Pending): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    } catch {
      // best effort — worst case we just don't resume after a reload
    }
  }

  /** Only removes the stored record if it still belongs to `purchaseId` — a
   * newer tracked purchase's entry must never be wiped by an older one's
   * resolution (see class doc comment). */
  private clearIfMatches(purchaseId: string): void {
    const pending = this.read();
    if (pending?.purchaseId !== purchaseId) return;
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      // best effort
    }
  }
}

export const storeSync = new StoreSync();
