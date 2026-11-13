import fs from 'node:fs';
import path from 'node:path';

export type BotRole = 'OWNER' | 'WAITER' | 'CHEF' | 'CASHIER' | 'DELIVERY';

export interface Session {
  userId: string;
  username: string;
  fullName: string;
  role: BotRole;
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp — only newer notifications are forwarded. */
  lastNotifiedAt: string;
  linkedAt: string;
}

/** Registered Telegram customer (remote delivery orders). */
export interface CustomerProfile {
  id?: string;
  fullName?: string;
  phone?: string;
  phoneVerified?: boolean;
  address?: string;
  lastReceipt?: string;
  lastOrderAt?: string;
}

interface Persisted {
  sessions: Record<string, Session>;
  customers: Record<string, CustomerProfile>;
}

/**
 * Tiny JSON-file persistence. The bot is a single process, so a read-modify-
 * write cycle with an atomic rename is safe enough for a small teahouse.
 */
export class Store {
  private data: Persisted = { sessions: {}, customers: {} };
  private writing = false;
  private queued = false;

  constructor(private file: string) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed && typeof parsed.sessions === 'object') this.data = parsed;
      if (!this.data.customers || typeof this.data.customers !== 'object') this.data.customers = {};
    } catch {
      // First run.
    }
  }

  customer(chatId: number | string): CustomerProfile {
    const key = String(chatId);
    if (!this.data.customers[key]) {
      this.data.customers[key] = {};
      this.persist();
    }
    return this.data.customers[key];
  }

  patchCustomer(chatId: number | string, patch: Partial<CustomerProfile>): void {
    const key = String(chatId);
    this.data.customers[key] = { ...this.customer(key), ...patch };
    this.persist();
  }

  get(chatId: number | string): Session | undefined {
    return this.data.sessions[String(chatId)];
  }

  set(chatId: number | string, session: Session): void {
    this.data.sessions[String(chatId)] = session;
    this.persist();
  }

  patch(chatId: number | string, patch: Partial<Session>): void {
    const current = this.data.sessions[String(chatId)];
    if (!current) return;
    this.data.sessions[String(chatId)] = { ...current, ...patch };
    this.persist();
  }

  remove(chatId: number | string): void {
    delete this.data.sessions[String(chatId)];
    this.persist();
  }

  all(): Array<[string, Session]> {
    return Object.entries(this.data.sessions);
  }

  private persist(): void {
    if (this.writing) {
      this.queued = true;
      return;
    }
    this.writing = true;
    const tmp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch {
      // Disk errors are non-fatal; sessions just become memory-only.
    } finally {
      this.writing = false;
      if (this.queued) {
        this.queued = false;
        this.persist();
      }
    }
  }
}

/**
 * Short callback references: Telegram callback_data is limited to 64 bytes,
 * which cannot hold two UUIDs. Refs map a per-chat short key to a real id.
 * In-memory only — stale buttons after a restart get a friendly error.
 */
export class Refs {
  private byChat = new Map<string, Map<string, string>>();
  private counter = 0;

  ref(chatId: number | string, id: string): string {
    const chat = String(chatId);
    let map = this.byChat.get(chat);
    if (!map) {
      map = new Map();
      this.byChat.set(chat, map);
    }
    for (const [key, value] of map) if (value === id) return key;
    const key = (++this.counter).toString(36);
    map.set(key, id);
    if (map.size > 400) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
    return key;
  }

  unref(chatId: number | string, key: string): string | undefined {
    return this.byChat.get(String(chatId))?.get(key);
  }
}
