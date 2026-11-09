import fs from 'node:fs';
import path from 'node:path';

export interface BotConfig {
  token: string;
  apiUrl: string;
  pollIntervalMs: number;
  storePath: string;
  miniAppUrl: string;
}

/** Minimal .env loader (no dependency). */
function loadDotEnv(file: string): void {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional
  }
}

export function loadConfig(): BotConfig {
  loadDotEnv(path.resolve(process.cwd(), '.env'));

  const token = process.env.BOT_TOKEN?.trim() ?? '';
  const apiUrl = (process.env.API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
  const pollIntervalMs = Math.max(3000, Number(process.env.BOT_NOTIFY_INTERVAL_MS ?? 10_000) || 10_000);
  const storePath = path.resolve(process.cwd(), process.env.BOT_STORE_PATH ?? 'data/sessions.json');
  const miniAppUrl = (process.env.MINI_APP_URL ?? 'http://localhost:5174').replace(/\/$/, '');

  return { token, apiUrl, pollIntervalMs, storePath, miniAppUrl };
}
