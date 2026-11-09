/**
 * End-to-end integration tests for the critical business workflows.
 * Covers the 18 scenarios from the specification (section 17).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapTestApp, req, type TestContext } from './helpers';

let ctx: TestContext;

// Shared fixtures discovered from the seeded database.
let roomId = '';
let productOqBaliq = { id: '', price: 45000 };
let productChoy = { id: '', price: 3000 };
let productNon = { id: '', price: 4000 };
let cashMethodId = '';

beforeAll(async () => {
  ctx = await bootstrapTestApp();

  const rooms = await req(ctx, 'GET', '/rooms', undefined, ctx.tokens.owner);
  expect(rooms.status).toBe(200);
  roomId = rooms.body[0].id;

  const products = await req(ctx, 'GET', '/products', undefined, ctx.tokens.owner);
  expect(products.status).toBe(200);
  productOqBaliq = products.body.find((p: { name: string }) => p.name === 'Оқ балиқ');
  productChoy = products.body.find((p: { name: string }) => p.name === 'Чой');
  productNon = products.body.find((p: { name: string }) => p.name === 'Нон');
  expect(productOqBaliq.id).toBeTruthy();

  const methods = await req(ctx, 'GET', '/payments/methods', undefined, ctx.tokens.cashier);
  cashMethodId = methods.body.find((m: { name: string }) => m.name === 'Naqd').id;
}, 180_000);

afterAll(async () => {
  await ctx?.app.close();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createDineIn(people: number, items: { productId: string; quantity: string }[], token = ctx.tokens.waiter): Promise<any> {
  const res = await req(ctx, 'POST', '/orders', { type: 'DINE_IN', roomId, numberOfPeople: people, items }, token);
  expect(res.status).toBe(201);
  return res.body;
}

describe('1-2. Dine-in order for 5 people → service fee 20 000', () => {
  it('creates order with snapshot fee', async () => {
    const order = await createDineIn(5, [
      { productId: productOqBaliq.id, quantity: '1' },
      { productId: productChoy.id, quantity: '5' },
    ]);
    expect(order.serviceFeeAmount).toBe(20000);
    expect(order.serviceFeePerPerson).toBe(4000);
    // items: 45 000 + 5×3 000 = 60 000; total = 80 000
    expect(order.itemsTotal).toBe(60000);
    expect(order.totalAmount).toBe(80000);
    expect(order.status).toBe('CONFIRMED');
    expect(order.roomName).toBeTruthy();
  });

  it('appears on the kitchen screen', async () => {
    const kitchen = await req(ctx, 'GET', '/orders/kitchen', undefined, ctx.tokens.chef);
    expect(kitchen.status).toBe(200);
    expect(kitchen.body.length).toBeGreaterThan(0);
    expect(kitchen.body[0].items[0].productName).toBeTruthy();
  });
});

describe('3-4. Delivery order for 2 people → service fee 8 000', () => {
  let deliveryOrderId = '';
  let deliveryId = '';

  it('creates delivery order with fee', async () => {
    const res = await req(
      ctx,
      'POST',
      '/orders',
      {
        type: 'DELIVERY',
        numberOfPeople: 2,
        customerName: 'Aziza Karimova',
        customerPhone: '+998901234567',
        address: 'Toshkent sh., Chilonzor tumani, 12-uy',
        items: [{ productId: productNon.id, quantity: '2' }],
      },
      ctx.tokens.waiter,
    );
    expect(res.status).toBe(201);
    expect(res.body.serviceFeeAmount).toBe(8000);
    expect(res.body.delivery.status).toBe('CONFIRMED');
    deliveryOrderId = res.body.id;
    deliveryId = res.body.delivery.id;
  });

  it('owner can see all delivery orders', async () => {
    const res = await req(ctx, 'GET', '/deliveries', undefined, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(res.body.some((d: { orderId: string }) => d.orderId === deliveryOrderId)).toBe(true);
  });

  it('delivery status transitions are enforced', async () => {
    // PREPARING from CONFIRMED is allowed.
    const ok = await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'PREPARING' }, ctx.tokens.owner);
    expect(ok.status).toBe(201);
    // DELIVERED straight from PREPARING is NOT allowed (must pass READY → OUT_FOR_DELIVERY).
    const bad = await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'DELIVERED' }, ctx.tokens.owner);
    expect(bad.status).toBe(400);
    // Complete the chain.
    await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'READY' }, ctx.tokens.owner);
    await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'OUT_FOR_DELIVERY' }, ctx.tokens.owner);
  });

  it('completes after delivery + full payment', async () => {
    // total = 2×4 000 + 8 000 = 16 000
    const pay = await req(ctx, 'POST', `/payments/order/${deliveryOrderId}`, { amount: 16000, methodId: cashMethodId }, ctx.tokens.cashier);
    expect(pay.status).toBe(201);
    const delivered = await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'DELIVERED' }, ctx.tokens.owner);
    expect(delivered.status).toBe(201);
    const order = await req(ctx, 'GET', `/orders/${deliveryOrderId}`, undefined, ctx.tokens.owner);
    expect(order.body.status).toBe('COMPLETED');
    expect(order.body.outstandingAmount).toBe(0);
  });
});

describe('5-7. Fee config change affects only future orders; history preserved', () => {
  let orderBeforeChange: { id: string; serviceFeeAmount: number } | null = null;

  it('creates baseline delivery order (8 000 fee)', async () => {
    const res = await req(
      ctx,
      'POST',
      '/orders',
      {
        type: 'DELIVERY',
        numberOfPeople: 2,
        customerName: 'Bobur Aliyev',
        customerPhone: '+998911112233',
        address: 'Samarqand sh., Registon ko‘chasi, 5-uy',
        items: [{ productId: productChoy.id, quantity: '2' }],
      },
      ctx.tokens.waiter,
    );
    expect(res.status).toBe(201);
    orderBeforeChange = { id: res.body.id, serviceFeeAmount: res.body.serviceFeeAmount };
    expect(orderBeforeChange.serviceFeeAmount).toBe(8000);
  });

  it('owner disables delivery fee', async () => {
    const res = await req(ctx, 'PATCH', '/settings/service-fee', { applyToDelivery: false }, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(res.body.applyToDelivery).toBe(false);
  });

  it('new delivery orders get NO fee; dine-in still gets fee', async () => {
    const delivery = await req(
      ctx,
      'POST',
      '/orders',
      {
        type: 'DELIVERY',
        numberOfPeople: 2,
        customerName: 'Dilnoza Rahimova',
        customerPhone: '+998933334455',
        address: 'Buxoro sh., Lyabi Hovuz, 3-uy',
        items: [{ productId: productChoy.id, quantity: '1' }],
      },
      ctx.tokens.waiter,
    );
    expect(delivery.status).toBe(201);
    expect(delivery.body.serviceFeeAmount).toBe(0);

    const dineIn = await createDineIn(3, [{ productId: productChoy.id, quantity: '1' }]);
    expect(dineIn.serviceFeeAmount).toBe(12000);
  });

  it('historical order keeps its original 8 000 fee', async () => {
    const res = await req(ctx, 'GET', `/orders/${orderBeforeChange!.id}`, undefined, ctx.tokens.owner);
    expect(res.body.serviceFeeAmount).toBe(8000);
    expect(res.body.totalAmount).toBe(6000 + 8000);
  });

  it('restore delivery fee for later tests', async () => {
    const res = await req(ctx, 'PATCH', '/settings/service-fee', { applyToDelivery: true }, ctx.tokens.owner);
    expect(res.status).toBe(200);
  });
});

describe('8-9. Product price change does not alter historical orders', () => {
  let orderId = '';

  it('creates order at current price (Чой = 3 000)', async () => {
    const order = await createDineIn(1, [{ productId: productChoy.id, quantity: '2' }]);
    orderId = order.id;
    expect(order.items[0].unitPrice).toBe(3000);
    expect(order.itemsTotal).toBe(6000);
  });

  it('owner changes price to 5 000', async () => {
    const res = await req(ctx, 'PATCH', `/products/${productChoy.id}`, { price: 5000 }, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(5000);
  });

  it('historical order totals are unchanged', async () => {
    const res = await req(ctx, 'GET', `/orders/${orderId}`, undefined, ctx.tokens.owner);
    expect(res.body.items[0].unitPrice).toBe(3000);
    expect(res.body.itemsTotal).toBe(6000);
    // total = 6 000 + 1×4 000 fee
    expect(res.body.totalAmount).toBe(10000);
  });

  it('new orders use the new price', async () => {
    const order = await createDineIn(1, [{ productId: productChoy.id, quantity: '1' }]);
    expect(order.items[0].unitPrice).toBe(5000);
  });

  it('restore original price', async () => {
    await req(ctx, 'PATCH', `/products/${productChoy.id}`, { price: 3000 }, ctx.tokens.owner);
  });
});

describe('10-12. Partial item readiness', () => {
  let orderId = '';
  let itemIds: string[] = [];
  let firstItemName = '';

  it('creates order with multiple items', async () => {
    const order = await createDineIn(2, [
      { productId: productOqBaliq.id, quantity: '0.750' },
      { productId: productNon.id, quantity: '2' },
      { productId: productChoy.id, quantity: '2' },
    ]);
    orderId = order.id;
    itemIds = order.items.map((i: { id: string }) => i.id);
    firstItemName = order.items.find((i: { id: string }) => i.id === itemIds[0]).productName;
    expect(itemIds.length).toBe(3);
    // 0.750 kg × 45 000 = 33 750 (integer UZS, no float issues)
    const fish = order.items.find((i: { productName: string }) => i.productName === 'Оқ балиқ');
    expect(fish.lineTotal).toBe(33750);
    expect(Number(fish.quantity)).toBe(0.75);
  });

  it('chef marks only ONE item ready', async () => {
    const res = await req(ctx, 'POST', `/orders/${orderId}/items/${itemIds[0]}/status`, { status: 'READY' }, ctx.tokens.chef);
    expect(res.status).toBe(201);
    // Items share createdAt timestamps, so locate by id instead of array index.
    const target = res.body.items.find((i: { id: string }) => i.id === itemIds[0]);
    const others = res.body.items.filter((i: { id: string }) => i.id !== itemIds[0]);
    expect(target.status).toBe('READY');
    expect(others.every((i: { status: string }) => i.status === 'PENDING')).toBe(true);
    expect(res.body.status).toBe('PARTIALLY_READY');
  });

  it('waiter receives a notification for the ready item', async () => {
    const res = await req(ctx, 'GET', '/notifications', undefined, ctx.tokens.waiter);
    expect(res.status).toBe(200);
    const notif = res.body.find((n: { type: string; data: { orderId?: string } | null }) => n.type === 'ITEM_READY' && n.data?.orderId === orderId);
    expect(notif).toBeTruthy();
    expect(notif.title).toContain(firstItemName);
  });

  it('waiter marks item served; chef finishes the rest', async () => {
    const served = await req(ctx, 'POST', `/orders/${orderId}/items/${itemIds[0]}/status`, { status: 'SERVED' }, ctx.tokens.waiter);
    expect(served.status).toBe(201);
    await req(ctx, 'POST', `/orders/${orderId}/items/${itemIds[1]}/status`, { status: 'READY' }, ctx.tokens.chef);
    const last = await req(ctx, 'POST', `/orders/${orderId}/items/${itemIds[2]}/status`, { status: 'READY' }, ctx.tokens.chef);
    // two ready + one served → READY overall
    expect(last.body.status).toBe('READY');
    await req(ctx, 'POST', `/orders/${orderId}/items/${itemIds[1]}/status`, { status: 'SERVED' }, ctx.tokens.waiter);
    const done = await req(ctx, 'POST', `/orders/${orderId}/items/${itemIds[2]}/status`, { status: 'SERVED' }, ctx.tokens.waiter);
    expect(done.body.status).toBe('SERVED');
  });

  it('order history records the lifecycle', async () => {
    const res = await req(ctx, 'GET', `/orders/${orderId}/history`, undefined, ctx.tokens.waiter);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(2);
    expect(res.body[0].toStatus).toBe('CONFIRMED');
  });
});

describe('13-16. Partial & full payments (150 000 → 100 000 + 50 000)', () => {
  let sessionId = '';
  let paymentIds: string[] = [];

  it('creates a 150 000 UQS bill (2 orders in one session)', async () => {
    // Xona 3 (fresh room): 32 000 + 134 000 ... use exact amounts:
    // order 1: 5 people, 0.5kg sazan? use oq baliq 2kg=90 000 + fee 20 000 = 110 000? Not 150k.
    // order 1: people=1, items: choy 12×3 000 = 36 000 + fee 4 000 = 40 000
    // order 2: people=5, items: oq baliq 2 = 90 000 + fee 20 000 = 110 000 → total 150 000
    const r = await req(ctx, 'GET', '/rooms', undefined, ctx.tokens.owner);
    const xona3 = r.body.find((x: { name: string }) => x.name === 'Xona 3');
    const o1 = await req(ctx, 'POST', '/orders', { type: 'DINE_IN', roomId: xona3.id, numberOfPeople: 1, items: [{ productId: productChoy.id, quantity: '12' }] }, ctx.tokens.waiter);
    expect(o1.status).toBe(201);
    const o2 = await req(ctx, 'POST', '/orders', { type: 'DINE_IN', roomId: xona3.id, numberOfPeople: 5, items: [{ productId: productOqBaliq.id, quantity: '2' }] }, ctx.tokens.waiter);
    expect(o2.status).toBe(201);
    expect(o1.body.roomSessionId).toBe(o2.body.roomSessionId);
    sessionId = o1.body.roomSessionId;

    const session = await req(ctx, 'GET', `/rooms/sessions/${sessionId}`, undefined, ctx.tokens.cashier);
    expect(session.body.totalAmount).toBe(150000);
    expect(session.body.outstandingAmount).toBe(150000);
  });

  it('accepts a partial payment of 100 000', async () => {
    const pay = await req(ctx, 'POST', `/payments/session/${sessionId}`, { amount: 100000, methodId: cashMethodId }, ctx.tokens.cashier);
    expect(pay.status).toBe(201);
    paymentIds.push(pay.body.id);
    const session = await req(ctx, 'GET', `/rooms/sessions/${sessionId}`, undefined, ctx.tokens.cashier);
    expect(session.body.paidAmount).toBe(100000);
    expect(session.body.outstandingAmount).toBe(50000);
  });

  it('idempotency: repeating the same payment key does not double-charge', async () => {
    const key = `test-idem-${Date.now()}`;
    const first = await req(ctx, 'POST', `/payments/session/${sessionId}`, { amount: 10000, methodId: cashMethodId, idempotencyKey: key }, ctx.tokens.cashier);
    expect(first.status).toBe(201);
    const second = await req(ctx, 'POST', `/payments/session/${sessionId}`, { amount: 10000, methodId: cashMethodId, idempotencyKey: key }, ctx.tokens.cashier);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    const session = await req(ctx, 'GET', `/rooms/sessions/${sessionId}`, undefined, ctx.tokens.cashier);
    expect(session.body.paidAmount).toBe(110000); // only ONE 10 000 was applied
    // reverse the test payment to restore the exact 100k/50k state
    const rev = await req(ctx, 'POST', `/payments/${first.body.id}/reverse`, { reason: 'Test to‘lovi qaytarildi' }, ctx.tokens.cashier);
    expect(rev.status).toBe(201);
    const after = await req(ctx, 'GET', `/rooms/sessions/${sessionId}`, undefined, ctx.tokens.cashier);
    expect(after.body.outstandingAmount).toBe(50000);
  });

  it('overpayment beyond outstanding is rejected', async () => {
    const pay = await req(ctx, 'POST', `/payments/session/${sessionId}`, { amount: 50001, methodId: cashMethodId }, ctx.tokens.cashier);
    expect(pay.status).toBe(400);
  });

  it('accepts the remaining 50 000 → bill fully paid', async () => {
    const pay = await req(ctx, 'POST', `/payments/session/${sessionId}`, { amount: 50000, methodId: cashMethodId }, ctx.tokens.cashier);
    expect(pay.status).toBe(201);
    const session = await req(ctx, 'GET', `/rooms/sessions/${sessionId}`, undefined, ctx.tokens.cashier);
    expect(session.body.outstandingAmount).toBe(0);
  });

  it('17. cashier closes the room once balance is zero', async () => {
    const close = await req(ctx, 'POST', `/rooms/sessions/${sessionId}/close`, {}, ctx.tokens.cashier);
    expect(close.status).toBe(201);
    expect(close.body.status).toBe('CLOSED');
  });
});

describe('17b. Room closure rules with outstanding balance', () => {
  let sessionId = '';

  it('creates an unpaid session', async () => {
    const r = await req(ctx, 'GET', '/rooms', undefined, ctx.tokens.owner);
    const xona3 = r.body.find((x: { name: string }) => x.name === 'Xona 3');
    const o = await req(ctx, 'POST', '/orders', { type: 'DINE_IN', roomId: xona3.id, numberOfPeople: 2, items: [{ productId: productNon.id, quantity: '1' }] }, ctx.tokens.waiter);
    expect(o.status).toBe(201);
    sessionId = o.body.roomSessionId;
  });

  it('cashier CANNOT close with outstanding balance', async () => {
    const close = await req(ctx, 'POST', `/rooms/sessions/${sessionId}/close`, {}, ctx.tokens.cashier);
    expect(close.status).toBe(403);
  });

  it('owner override requires a reason', async () => {
    const noReason = await req(ctx, 'POST', `/rooms/sessions/${sessionId}/close`, {}, ctx.tokens.owner);
    expect(noReason.status).toBe(400);
    const withReason = await req(ctx, 'POST', `/rooms/sessions/${sessionId}/close`, { overrideReason: 'Mijoz keyin to‘laydi — telefon orqali kelishildi' }, ctx.tokens.owner);
    expect(withReason.status).toBe(201);
    expect(withReason.body.status).toBe('CLOSED');
  });

  it('override is recorded in the audit log', async () => {
    const logs = await req(ctx, 'GET', '/audit-logs?limit=20', undefined, ctx.tokens.owner);
    const entry = logs.body.find((l: { action: string; entityId: string }) => l.action === 'SESSION_CLOSE_OVERRIDE' && l.entityId === sessionId);
    expect(entry).toBeTruthy();
  });
});

describe('18. Authorization enforcement (backend, not just frontend)', () => {
  it('waiter cannot access owner reports', async () => {
    expect((await req(ctx, 'GET', '/reports/dashboard', undefined, ctx.tokens.waiter)).status).toBe(403);
    expect((await req(ctx, 'GET', '/reports/summary?from=2026-01-01&to=2026-12-31', undefined, ctx.tokens.waiter)).status).toBe(403);
  });

  it('waiter cannot manage employees', async () => {
    expect((await req(ctx, 'GET', '/employees', undefined, ctx.tokens.waiter)).status).toBe(403);
    expect((await req(ctx, 'POST', '/employees', { username: 'x1', password: 'password1', fullName: 'X', role: 'WAITER' }, ctx.tokens.waiter)).status).toBe(403);
  });

  it('waiter cannot change service fee settings', async () => {
    expect((await req(ctx, 'PATCH', '/settings/service-fee', { amountPerPerson: 100 }, ctx.tokens.waiter)).status).toBe(403);
  });

  it('chef cannot access payments or cashier data', async () => {
    expect((await req(ctx, 'GET', '/payments', undefined, ctx.tokens.chef)).status).toBe(403);
    expect((await req(ctx, 'POST', '/payments/order/anything', { amount: 100, methodId: cashMethodId }, ctx.tokens.chef)).status).toBe(403);
  });

  it('chef cannot create orders or manage products', async () => {
    expect((await req(ctx, 'POST', '/orders', { type: 'DINE_IN', roomId, numberOfPeople: 1, items: [{ productId: productNon.id, quantity: '1' }] }, ctx.tokens.chef)).status).toBe(403);
    expect((await req(ctx, 'PATCH', `/products/${productNon.id}`, { price: 1 }, ctx.tokens.chef)).status).toBe(403);
  });

  it('cashier cannot manage products/rooms/employees', async () => {
    expect((await req(ctx, 'POST', '/rooms', { name: 'Yaratilmaydigan xona' }, ctx.tokens.cashier)).status).toBe(403);
    expect((await req(ctx, 'POST', '/products', { name: 'X', categoryId: 'x', unit: 'PIECE', price: 100 }, ctx.tokens.cashier)).status).toBe(403);
  });

  it('unauthenticated requests are rejected', async () => {
    expect((await req(ctx, 'GET', '/orders')).status).toBe(401);
    expect((await req(ctx, 'GET', '/reports/dashboard')).status).toBe(401);
  });

  it('invalid tokens are rejected', async () => {
    expect((await req(ctx, 'GET', '/orders', undefined, 'invalid-token')).status).toBe(401);
  });
});

describe('Product management', () => {
  let categoryId = '';
  let productId = '';

  it('owner creates category + product, then archives and restores', async () => {
    const cats = await req(ctx, 'GET', '/categories', undefined, ctx.tokens.owner);
    categoryId = cats.body[0].id;

    const created = await req(ctx, 'POST', '/products', { name: 'Test mahsulot', categoryId, unit: 'KG', price: 123000 }, ctx.tokens.owner);
    expect(created.status).toBe(201);
    productId = created.body.id;

    const archived = await req(ctx, 'PATCH', `/products/${productId}`, { status: 'ARCHIVED' }, ctx.tokens.owner);
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('ARCHIVED');

    // Archived products are hidden from the default list but visible with includeArchived.
    const list = await req(ctx, 'GET', '/products', undefined, ctx.tokens.owner);
    expect(list.body.some((p: { id: string }) => p.id === productId)).toBe(false);
    const withArchived = await req(ctx, 'GET', '/products?includeArchived=true', undefined, ctx.tokens.owner);
    expect(withArchived.body.some((p: { id: string }) => p.id === productId)).toBe(true);

    const restored = await req(ctx, 'PATCH', `/products/${productId}`, { status: 'ACTIVE' }, ctx.tokens.owner);
    expect(restored.body.status).toBe('ACTIVE');
  });

  it('archived/disabled products cannot be ordered', async () => {
    await req(ctx, 'PATCH', `/products/${productId}`, { status: 'DISABLED' }, ctx.tokens.owner);
    const res = await req(ctx, 'POST', '/orders', { type: 'DINE_IN', roomId, numberOfPeople: 1, items: [{ productId, quantity: '1' }] }, ctx.tokens.waiter);
    expect(res.status).toBe(400);
    await req(ctx, 'PATCH', `/products/${productId}`, { status: 'ACTIVE' }, ctx.tokens.owner);
  });

  it('product image upload validates and stores files', async () => {
    // 1x1 px PNG
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'test.png');
    const uploaded = await req(ctx, 'POST', `/products/${productId}/image`, undefined, ctx.tokens.owner, form);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.imageUrl).toMatch(/^\/uploads\//);

    // Invalid type rejected.
    const badForm = new FormData();
    badForm.append('image', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'x.txt');
    const bad = await req(ctx, 'POST', `/products/${productId}/image`, undefined, ctx.tokens.owner, badForm);
    expect(bad.status).toBe(400);

    // Remove image.
    const removed = await req(ctx, 'DELETE', `/products/${productId}/image`, undefined, ctx.tokens.owner);
    expect(removed.status).toBe(200);
    expect(removed.body.imageUrl).toBeNull();
  });

  it('price changes are audited', async () => {
    await req(ctx, 'PATCH', `/products/${productId}`, { price: 130000 }, ctx.tokens.owner);
    const logs = await req(ctx, 'GET', '/audit-logs?limit=50', undefined, ctx.tokens.owner);
    const entry = logs.body.find((l: { action: string; entityId: string }) => l.action === 'PRODUCT_PRICE_CHANGED' && l.entityId === productId);
    expect(entry).toBeTruthy();
  });
});

describe('Reports & dashboard', () => {
  it('owner dashboard returns financial summary', async () => {
    const res = await req(ctx, 'GET', '/reports/dashboard', undefined, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(typeof res.body.todayRevenue).toBe('number');
    expect(typeof res.body.serviceFeeRevenueToday).toBe('number');
    expect(Array.isArray(res.body.revenueByDay)).toBe(true);
  });

  it('summary report distinguishes revenue, expenses and profit', async () => {
    const exp = await req(ctx, 'POST', '/expenses', { title: 'Test xarajat', amount: 25000, category: 'Test' }, ctx.tokens.owner);
    expect(exp.status).toBe(201);
    const res = await req(ctx, 'GET', '/reports/summary?from=2026-01-01&to=2026-12-31', undefined, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(res.body.profit).toBe(res.body.revenue - res.body.expenses);
    expect(res.body.expenses).toBeGreaterThanOrEqual(25000);
    expect(Array.isArray(res.body.paymentsByMethod)).toBe(true);
    expect(Array.isArray(res.body.employeePerformance)).toBe(true);
  });
});
