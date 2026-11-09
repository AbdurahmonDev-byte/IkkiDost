#!/usr/bin/env node
/** Starts the embedded PostgreSQL server in the foreground (used by db-ensure as a detached child). */
const path = require('path');

const API_DIR = path.resolve(__dirname, '..');
const PG_PORT = Number(process.env.EMBEDDED_PG_PORT || 5433);
const PG_DIR = path.resolve(API_DIR, process.env.EMBEDDED_PG_DIR || '.pgdata');

async function main() {
  // initdb fails on exotic system locales (e.g. uz_UZ) — force a neutral one.
  process.env.LC_ALL = 'C.UTF-8';
  process.env.LANG = 'C.UTF-8';
  const EmbeddedPostgres = require('embedded-postgres').default;
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: process.env.EMBEDDED_PG_USER || 'postgres',
    password: process.env.EMBEDDED_PG_PASSWORD || 'postgres',
    port: PG_PORT,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  // Only initialize a fresh data directory; re-running initdb on an existing one fails.
  const fs = require('fs');
  const initialized = fs.existsSync(path.join(PG_DIR, 'PG_VERSION'));
  if (!initialized) await pg.initialise();
  await pg.start();
  console.log(`[db-start] PostgreSQL listening on port ${PG_PORT} (data: ${PG_DIR})`);

  const stop = async () => {
    try { await pg.stop(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('[db-start] FAILED:', err);
  process.exit(1);
});
