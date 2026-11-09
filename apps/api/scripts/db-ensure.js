#!/usr/bin/env node
/**
 * Ensures a local embedded PostgreSQL server is running and the app database exists.
 * - First run downloads PostgreSQL binaries into .pgdata/ (gitignored).
 * - If the server is not running, it is spawned as a detached background process.
 * - Creates the database if missing and writes apps/api/.env if absent.
 */
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const API_DIR = path.resolve(__dirname, '..');
const PG_PORT = Number(process.env.EMBEDDED_PG_PORT || 5433);
const PG_DIR = path.resolve(API_DIR, process.env.EMBEDDED_PG_DIR || '.pgdata');
const PG_USER = process.env.EMBEDDED_PG_USER || 'postgres';
const PG_PASSWORD = process.env.EMBEDDED_PG_PASSWORD || 'postgres';
const DB_NAME = process.env.EMBEDDED_PG_DATABASE || 'ikki_dost';

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`PostgreSQL did not start within ${timeoutMs}ms`);
}

function ensureEnvFile() {
  const envPath = path.join(API_DIR, '.env');
  const url = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${DB_NAME}?schema=public`;
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      [
        `DATABASE_URL="${url}"`,
        'JWT_ACCESS_SECRET="dev-access-secret-0123456789abcdef0123456789"',
        'JWT_REFRESH_SECRET="dev-refresh-secret-0123456789abcdef01234567"',
        'JWT_ACCESS_TTL="15m"',
        'JWT_REFRESH_TTL="30d"',
        'PORT=3000',
        'API_PREFIX="api"',
        'CORS_ORIGINS="http://localhost:3001,http://localhost:3002,http://localhost:5173"',
        'UPLOAD_DIR="uploads"',
        'MAX_IMAGE_SIZE_BYTES=5242880',
        `EMBEDDED_PG_PORT=${PG_PORT}`,
        'EMBEDDED_PG_DIR=".pgdata"',
        'VAPID_PUBLIC_KEY=""',
        'VAPID_PRIVATE_KEY=""',
        'VAPID_SUBJECT="mailto:admin@ikkidost.uz"',
        '',
      ].join('\n'),
    );
    console.log('[db-ensure] Created apps/api/.env (development defaults — change secrets for production)');
  }
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = url;
}

async function main() {
  ensureEnvFile();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EmbeddedPostgres = require('embedded-postgres').default;
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
    onLog: () => {},
    onError: (msg) => console.error('[pg]', msg),
  });

  const running = await isPortOpen(PG_PORT);
  if (!running) {
    console.log('[db-ensure] Initializing embedded PostgreSQL (first run downloads binaries)...');
    await pg.initialise();
    console.log('[db-ensure] Starting PostgreSQL in background...');
    const child = spawn(process.execPath, [path.join(__dirname, 'db-start.js')], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' },
    });
    child.unref();
    await waitForPort(PG_PORT);
    console.log(`[db-ensure] PostgreSQL running on port ${PG_PORT}`);
  }

  // Create database if missing (connects to the already-running server).
  const { Client } = require('pg');
  const client = new Client({ user: PG_USER, password: PG_PASSWORD, host: 'localhost', port: PG_PORT, database: 'postgres' });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${DB_NAME.replace(/"/g, '')}"`);
    console.log(`[db-ensure] Database "${DB_NAME}" created`);
  } catch (err) {
    if (err && err.code === '42P04') {
      // 42P04 = duplicate_database — fine
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }

  console.log('[db-ensure] Ready.');
}

main().catch((err) => {
  console.error('[db-ensure] FAILED:', err);
  process.exit(1);
});
