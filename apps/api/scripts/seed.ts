/**
 * Seeds the initial database state:
 * - owner + demo employees for each role (passwords via env or dev defaults),
 * - example rooms,
 * - categories + the 14 specified products (original spelling preserved),
 * - payment methods (Naqd / Karta),
 * - service fee config: enabled, 4 000 UZS per person, both order types.
 *
 * Idempotent: safe to run multiple times.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEV_PASSWORD = process.env.SEED_PASSWORD || 'password123';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'owner12345';

async function main() {
  console.log('[seed] Starting...');

  // ===== Users =====
  async function upsertUser(username: string, password: string, fullName: string, role: 'OWNER' | 'WAITER' | 'CHEF' | 'CASHIER', canCreateDelivery = false) {
    const passwordHash = await argon2.hash(password);
    return prisma.user.upsert({
      where: { username },
      create: { username, passwordHash, fullName, role, canCreateDelivery },
      update: { fullName, role, canCreateDelivery },
    });
  }

  const owner = await upsertUser('owner', OWNER_PASSWORD, 'Choyxona egasi', 'OWNER');
  await upsertUser('ofitsiant', DEV_PASSWORD, 'Ofitsiant Olim', 'WAITER', true);
  await upsertUser('oshpaz', DEV_PASSWORD, 'Oshpaz Jasur', 'CHEF');
  await upsertUser('kassir', DEV_PASSWORD, 'Kassir Dilnoza', 'CASHIER');
  console.log('[seed] Users ready (owner login: "owner")');

  // ===== Rooms =====
  for (const name of ['Xona 1', 'Xona 2', 'Xona 3']) {
    await prisma.room.upsert({ where: { name }, create: { name }, update: {} });
  }
  console.log('[seed] Rooms ready');

  // ===== Categories =====
  async function upsertCategory(name: string, sortOrder: number) {
    return prisma.category.upsert({ where: { name }, create: { name, sortOrder }, update: { sortOrder } });
  }
  const catTaomlar = await upsertCategory('Asosiy taomlar', 1);
  const catSalat = await upsertCategory('Salat va qo‘shimchalar', 2);
  const catNon = await upsertCategory('Non', 3);
  const catIchimlik = await upsertCategory('Ichimliklar', 4);

  // ===== Products (exact supplied names; integer UZS) =====
  async function upsertProduct(name: string, categoryId: string, unit: 'PIECE' | 'KG' | 'LITER' | 'PORTION' | 'OTHER', price: number) {
    const existing = await prisma.product.findFirst({ where: { name, categoryId } });
    if (existing) return prisma.product.update({ where: { id: existing.id }, data: { unit, price } });
    return prisma.product.create({ data: { name, categoryId, unit, price } });
  }

  // Asosiy taomlar
  await upsertProduct('Оқ балиқ', catTaomlar.id, 'KG', 45_000);
  await upsertProduct('Сазан', catTaomlar.id, 'KG', 70_000);
  await upsertProduct('Табака', catTaomlar.id, 'PIECE', 70_000);
  // Salat va qo‘shimchalar
  await upsertProduct('Шўр карам', catSalat.id, 'PORTION', 5_000);
  await upsertProduct('Ёғли карам', catSalat.id, 'PORTION', 5_000);
  await upsertProduct('Сузма', catSalat.id, 'PORTION', 5_000);
  // Non
  await upsertProduct('Нон', catNon.id, 'PIECE', 4_000);
  await upsertProduct('Нон яримта', catNon.id, 'PIECE', 2_000);
  // Ichimliklar
  await upsertProduct('Чой', catIchimlik.id, 'PORTION', 3_000);
  await upsertProduct('Pepsi 1L', catIchimlik.id, 'LITER', 12_000);
  await upsertProduct('Fanta 1L', catIchimlik.id, 'LITER', 12_000);
  await upsertProduct('Cola 1L', catIchimlik.id, 'LITER', 12_000);
  await upsertProduct('Flesh', catIchimlik.id, 'LITER', 12_000);
  await upsertProduct('Ҳамза сув', catIchimlik.id, 'PIECE', 4_000);
  console.log('[seed] Products ready (14 items)');

  // ===== Payment methods =====
  for (const m of [
    { name: 'Naqd', kind: 'CASH' as const },
    { name: 'Karta', kind: 'CARD' as const },
  ]) {
    await prisma.paymentMethod.upsert({ where: { name: m.name }, create: m, update: { kind: m.kind } });
  }
  console.log('[seed] Payment methods ready');

  // ===== Service fee configuration (defaults per specification) =====
  await prisma.serviceFeeConfig.upsert({
    where: { id: 'service_fee_config' },
    create: { id: 'service_fee_config', enabled: true, amountPerPerson: 4_000, deliveryFeeAmount: 5_000, applyToDineIn: true, applyToDelivery: false },
    update: { deliveryFeeAmount: 5_000, applyToDelivery: false },
  });
  console.log('[seed] Service fee config ready (4 000 so‘m / kishi)');

  console.log('[seed] DONE.');
}

main()
  .catch((err) => {
    console.error('[seed] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
