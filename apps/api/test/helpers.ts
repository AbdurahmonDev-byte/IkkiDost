/**
 * Integration-test bootstrap: dedicated test database (ikki_dost_test) on the
 * embedded PostgreSQL server, migrations applied, seed data loaded, Nest app
 * listening on an ephemeral port.
 */
import { execSync } from 'child_process';
import { createHmac } from 'crypto';
import path from 'path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const API_DIR = path.resolve(__dirname, '..');
const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5433/ikki_dost_test?schema=public';
const TEST_BOT_TOKEN = 'test-telegram-bot-token';

function telegramInitData(id: string): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: 'Test', last_name: 'Employee' }),
  });
  const checkString = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

export interface TestContext {
  app: INestApplication;
  baseUrl: string;
  tokens: Record<'owner' | 'waiter' | 'chef' | 'cashier', string>;
}

export async function bootstrapTestApp(): Promise<TestContext> {
  // 1. Ensure embedded PG is running + test DB exists.
  process.env.EMBEDDED_PG_DATABASE = 'ikki_dost_test';
  execSync('node scripts/db-ensure.js', { cwd: API_DIR, stdio: 'pipe', env: { ...process.env } });

  // 2. Reset the test database (clean, isolated state), migrate, then seed.
  execSync('npx prisma migrate reset --force --skip-generate --skip-seed', {
    cwd: API_DIR,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
  execSync('node --experimental-strip-types scripts/seed.ts', { cwd: API_DIR, stdio: 'pipe', env: { ...process.env, DATABASE_URL: TEST_DB_URL } });

  // 3. Boot the Nest application against the test DB.
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef01234567';
  process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.UPLOAD_DIR = '.test-uploads';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;

  const ctx: TestContext = {
    app,
    baseUrl: `http://127.0.0.1:${port}/api`,
    tokens: { owner: '', waiter: '', chef: '', cashier: '' },
  };

  // 4. Provision and authenticate test staff through their Telegram identities.
  ctx.tokens.owner = await login(ctx, 'owner', 'owner12345');
  const employees = await req(ctx, 'GET', '/employees', undefined, ctx.tokens.owner);
  for (const [username, telegramId] of [
    ['ofitsiant', '666600001'],
    ['oshpaz', '666600002'],
    ['kassir', '666600003'],
  ]) {
    const employee = employees.body.find((item: { username: string }) => item.username === username);
    const assigned = await req(ctx, 'PATCH', `/employees/${employee.id}`, { telegramId }, ctx.tokens.owner);
    expect(assigned.status).toBe(200);
  }
  ctx.tokens.waiter = await loginByTelegram(ctx, '666600001');
  ctx.tokens.chef = await loginByTelegram(ctx, '666600002');
  ctx.tokens.cashier = await loginByTelegram(ctx, '666600003');

  return ctx;
}

export async function login(ctx: TestContext, username: string, password: string): Promise<string> {
  const res = await req(ctx, 'POST', '/auth/login', { username, password });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

async function loginByTelegram(ctx: TestContext, telegramId: string): Promise<string> {
  const res = await req(ctx, 'POST', '/auth/telegram', { initData: telegramInitData(telegramId) });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

export interface TestResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

/** Minimal fetch helper with optional bearer token. */
export async function req(
  ctx: TestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
  formData?: FormData,
): Promise<TestResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let parsed: unknown = undefined;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
