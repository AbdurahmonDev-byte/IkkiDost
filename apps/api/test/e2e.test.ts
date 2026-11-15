/**
 * End-to-end integration tests for the critical business workflows.
 * Covers the 18 scenarios from the specification (section 17).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import { bootstrapTestApp, req, type TestContext } from './helpers';

let ctx: TestContext;

// Shared fixtures discovered from the seeded database.
let roomId = '';
let productOqBaliq = { id: '', price: 45000 };
let productChoy = { id: '', price: 3000 };
let productNon = { id: '', price: 4000 };
let cashMethodId = '';
const testBotToken = 'test-telegram-bot-token';

function telegramInitData(id: string, firstName: string, lastName: string): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: firstName, last_name: lastName }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(testBotToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

beforeAll(async () => {
  process.env.BOT_TOKEN = testBotToken;
  process.env.OWNER_TELEGRAM_IDS = '7483287151,317080284';
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

describe('Telegram identity and customer registration', () => {
  it('authenticates staff by owner-assigned Telegram ID and requires the owner extra password', async () => {
    const waiterInitData = telegramInitData('777700001', 'Waiter', 'Test');
    const employees = await req(ctx, 'GET', '/employees', undefined, ctx.tokens.owner);
    const waiter = employees.body.find((employee: { username: string }) => employee.username === 'ofitsiant');
    const assignWaiterTelegram = await req(
      ctx,
      'PATCH',
      `/employees/${waiter.id}`,
      { telegramId: '777700001' },
      ctx.tokens.owner,
    );
    expect(assignWaiterTelegram.status).toBe(200);

    const waiterLogin = await req(ctx, 'POST', '/auth/telegram', { initData: waiterInitData });
    expect(waiterLogin.status).toBe(201);
    expect(waiterLogin.body.user.role).toBe('WAITER');
    expect((await req(ctx, 'GET', '/rooms', undefined, waiterLogin.body.accessToken)).status).toBe(200);
    expect((await req(ctx, 'GET', '/reports/dashboard', undefined, waiterLogin.body.accessToken)).status).toBe(403);

    const waiterPasswordLogin = await req(ctx, 'POST', '/auth/login', {
      username: 'ofitsiant',
      password: 'password123',
    });
    expect(waiterPasswordLogin.status).toBe(401);
    expect(waiterPasswordLogin.body.details.code).toBe('TELEGRAM_LOGIN_REQUIRED');

    const waiterSelfLink = await req(ctx, 'POST', '/auth/link-telegram', {
      initData: telegramInitData('777700004', 'Waiter', 'Other'),
      username: 'ofitsiant',
      password: 'password123',
    });
    expect(waiterSelfLink.status).toBe(401);
    expect(waiterSelfLink.body.details.code).toBe('TELEGRAM_ID_OWNER_ASSIGNMENT_REQUIRED');

    const reservedOwnerId = await req(
      ctx,
      'PATCH',
      `/employees/${waiter.id}`,
      { telegramId: '7483287151' },
      ctx.tokens.owner,
    );
    expect(reservedOwnerId.status).toBe(400);

    const newCourier = await req(ctx, 'POST', '/employees', {
      username: 'courier_test',
      password: 'internal-only-password',
      fullName: 'Test Courier',
      role: 'DELIVERY',
      telegramId: '777700005',
    }, ctx.tokens.owner);
    expect(newCourier.status).toBe(201);
    const courierLogin = await req(ctx, 'POST', '/auth/telegram', {
      initData: telegramInitData('777700005', 'Courier', 'Test'),
    });
    expect(courierLogin.status).toBe(201);
    expect(courierLogin.body.user.role).toBe('DELIVERY');

    const ownerInitData = telegramInitData('777700002', 'Owner', 'Test');
    const owner = employees.body.find((employee: { username: string }) => employee.username === 'owner');
    const assignOwnerTelegram = await req(
      ctx,
      'PATCH',
      `/employees/${owner.id}`,
      { telegramId: '777700002' },
      ctx.tokens.owner,
    );
    expect(assignOwnerTelegram.status).toBe(200);

    const ownerLogin = await req(ctx, 'POST', '/auth/telegram', { initData: ownerInitData });
    expect(ownerLogin.status).toBe(201);
    expect(ownerLogin.body.user.role).toBe('OWNER');

    const unassignedTelegram = await req(ctx, 'POST', '/auth/telegram', {
      initData: telegramInitData('777700099', 'Unknown', 'Staff'),
    });
    expect(unassignedTelegram.status).toBe(401);
    expect(unassignedTelegram.body.details.code).toBe('TELEGRAM_NOT_LINKED');

    for (const ownerTelegramId of ['7483287151', '317080284']) {
      const ownerIdentity = telegramInitData(ownerTelegramId, 'Owner', 'Allowlist');
      const allowedOwnerLogin = await req(ctx, 'POST', '/auth/telegram', { initData: ownerIdentity });
      expect(allowedOwnerLogin.status).toBe(201);
      expect(allowedOwnerLogin.body.user.role).toBe('OWNER');
    }
  });

  it('requires verified registration and only permits public delivery orders', async () => {
    const customerInitData = telegramInitData('777700003', 'Telegram', 'Name');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('https://api.telegram.org/')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const registration = await req(ctx, 'POST', '/public/register', {
        initData: customerInitData,
        firstName: 'Rasmiy',
        lastName: 'Mijoz',
        phone: '+998901234567',
      });
      expect(registration.status).toBe(201);
      expect(registration.body.customer.fullName).toBe('Rasmiy Mijoz');
      expect(registration.body.customer.phoneVerified).toBe(false);
      expect(registration.body.verificationSent).toBe(true);

      const orderInput = {
        type: 'DELIVERY',
        numberOfPeople: 1,
        items: [{ productId: productChoy.id, quantity: '1' }],
        address: 'Toshkent, Chilonzor 12-uy',
        initData: customerInitData,
      };
      const unverifiedOrder = await req(ctx, 'POST', '/public/orders', orderInput);
      expect(unverifiedOrder.status, JSON.stringify(unverifiedOrder.body)).toBe(403);
      expect(unverifiedOrder.body.details.code).toBe('PHONE_NOT_VERIFIED');

      const verified = await fetch(`${ctx.baseUrl}/public/verify-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': testBotToken,
        },
        body: JSON.stringify({
          telegramId: '777700003',
          contactUserId: '777700003',
          phone: '+998901234567',
        }),
      });
      expect(verified.status).toBe(201);

      const deliveryOrder = await req(ctx, 'POST', '/public/orders', orderInput);
      expect(deliveryOrder.status).toBe(201);
      expect(deliveryOrder.body.delivery.customerName).toBe('Rasmiy Mijoz');
      expect(deliveryOrder.body.customerId).toBe(registration.body.customer.id);

      const dineInOrder = await req(ctx, 'POST', '/public/orders', {
        ...orderInput,
        type: 'DINE_IN',
      });
      expect(dineInOrder.status).toBe(400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Customer delivery location', () => {
  const initData = telegramInitData('777700006', 'Lokatsiya', 'Mijoz');
  const mapLink = 'https://maps.google.com/?q=41.299496,69.240073';

  it('bot saves the location and the profile prefills it', async () => {
    const registered = await fetch(`${ctx.baseUrl}/public/register/bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': testBotToken },
      body: JSON.stringify({
        telegramId: '777700006',
        firstName: 'Lokatsiya',
        lastName: 'Mijoz',
        phone: '+998901112233',
      }),
    });
    expect(registered.status).toBe(201);

    const patched = await fetch(`${ctx.baseUrl}/public/customers/bot`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': testBotToken },
      body: JSON.stringify({ telegramId: '777700006', deliveryAddress: mapLink }),
    });
    expect(patched.status).toBe(200);
    const patchedBody = (await patched.json()) as { customer: { deliveryAddress: string | null } };
    expect(patchedBody.customer.deliveryAddress).toBe(mapLink);

    const me = await fetch(`${ctx.baseUrl}/public/me`, {
      headers: { 'X-Telegram-Init-Data': initData },
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { customer: { deliveryAddress: string | null } };
    expect(meBody.customer.deliveryAddress).toBe(mapLink);
  });

  it('persists the order address for the next Mini App visit', async () => {
    const address = 'Toshkent, Yunusobod 7-kvartal, 21-uy';
    const order = await req(ctx, 'POST', '/public/orders', {
      type: 'DELIVERY',
      numberOfPeople: 1,
      items: [{ productId: productChoy.id, quantity: '1' }],
      address,
      initData,
    });
    expect(order.status, JSON.stringify(order.body)).toBe(201);
    expect(order.body.delivery.address).toBe(address);

    const me = await fetch(`${ctx.baseUrl}/public/me`, {
      headers: { 'X-Telegram-Init-Data': initData },
    });
    const meBody = (await me.json()) as { customer: { deliveryAddress: string | null } };
    expect(meBody.customer.deliveryAddress).toBe(address);
  });
});

describe('Courier cash collection → cashier handover', () => {
  let deliveryId = '';
  let orderId = '';
  let totalAmount = 0;
  let courierToken = '';

  it('courier records collected cash when marking the delivery delivered', async () => {
    const courier = await req(ctx, 'POST', '/employees', {
      username: 'courier_cash_test',
      password: 'internal-only-password',
      fullName: 'Cash Courier',
      role: 'DELIVERY',
      telegramId: '777700007',
    }, ctx.tokens.owner);
    expect(courier.status).toBe(201);

    const courierLogin = await req(ctx, 'POST', '/auth/telegram', {
      initData: telegramInitData('777700007', 'Cash', 'Courier'),
    });
    expect(courierLogin.status).toBe(201);
    courierToken = courierLogin.body.accessToken;

    const created = await req(ctx, 'POST', '/orders', {
      type: 'DELIVERY',
      numberOfPeople: 1,
      customerName: 'Naqd Mijoz',
      customerPhone: '+998901234000',
      address: 'Toshkent, Mirzo Ulug‘bek, 5-uy',
      items: [{ productId: productChoy.id, quantity: '1' }],
    }, ctx.tokens.waiter);
    expect(created.status).toBe(201);
    orderId = created.body.id;
    deliveryId = created.body.delivery.id;
    totalAmount = created.body.totalAmount;

    await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'PREPARING' }, ctx.tokens.owner);
    await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'READY' }, ctx.tokens.owner);
    expect((await req(ctx, 'POST', `/deliveries/${deliveryId}/claim`, undefined, courierToken)).status).toBe(201);
    expect((await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, { status: 'OUT_FOR_DELIVERY' }, courierToken)).status).toBe(201);

    const delivered = await req(ctx, 'POST', `/deliveries/${deliveryId}/status`, {
      status: 'DELIVERED',
      cashCollectedAmount: totalAmount,
    }, courierToken);
    expect(delivered.status, JSON.stringify(delivered.body)).toBe(201);
    expect(delivered.body.cashCollectedAmount).toBe(totalAmount);
    expect(delivered.body.cashCollectedAt).toBeTruthy();
    expect(delivered.body.cashHandedOverAt).toBeNull();
    expect(delivered.body.outstandingAmount).toBe(totalAmount);

    const forbiddenHandover = await req(ctx, 'POST', `/deliveries/${deliveryId}/handover`, {}, courierToken);
    expect(forbiddenHandover.status).toBe(403);
  });

  it('cashier confirms the handover and the order becomes paid + completed', async () => {
    const handover = await req(ctx, 'POST', `/deliveries/${deliveryId}/handover`, {}, ctx.tokens.cashier);
    expect(handover.status, JSON.stringify(handover.body)).toBe(201);
    expect(handover.body.cashHandedOverAt).toBeTruthy();
    expect(handover.body.paidAmount).toBe(totalAmount);
    expect(handover.body.outstandingAmount).toBe(0);

    const order = await req(ctx, 'GET', `/orders/${orderId}`, undefined, ctx.tokens.owner);
    expect(order.body.paidAmount).toBe(totalAmount);
    expect(order.body.status).toBe('COMPLETED');

    const second = await req(ctx, 'POST', `/deliveries/${deliveryId}/handover`, {}, ctx.tokens.cashier);
    expect(second.status).toBe(400);
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
    const cost = await req(ctx, 'PATCH', `/products/${productChoy.id}`, { costPrice: 1000 }, ctx.tokens.owner);
    expect(cost.status).toBe(200);
    const order = await createDineIn(1, [{ productId: productChoy.id, quantity: '2' }]);
    orderId = order.id;
    expect(order.items[0].unitPrice).toBe(3000);
    expect(order.itemsTotal).toBe(6000);
  });

  it('owner changes price to 5 000', async () => {
    const res = await req(ctx, 'PATCH', `/products/${productChoy.id}`, { price: 5000, costPrice: 2500 }, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(5000);
  });

  it('profit report keeps the original cost snapshot', async () => {
    const report = await req(ctx, 'GET', '/reports/summary?from=2026-01-01&to=2026-12-31', undefined, ctx.tokens.owner);
    expect(report.body.costOfGoods).toBe(2000);
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
    await req(ctx, 'PATCH', `/products/${productChoy.id}`, { price: 3000, costPrice: 0 }, ctx.tokens.owner);
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

  it('cashier override requires a reason', async () => {
    const close = await req(ctx, 'POST', `/rooms/sessions/${sessionId}/close`, {}, ctx.tokens.cashier);
    expect(close.status).toBe(400);
    const withReason = await req(ctx, 'POST', `/rooms/sessions/${sessionId}/close`, { overrideReason: 'Mijoz keyin to‘laydi — telefon orqali kelishildi' }, ctx.tokens.cashier);
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

  it('cashier can manage rooms and products', async () => {
    const employees = await req(ctx, 'GET', '/employees', undefined, ctx.tokens.cashier);
    expect(employees.status).toBe(200);
    expect((await req(ctx, 'GET', '/reports/dashboard', undefined, ctx.tokens.cashier)).status).toBe(200);
    const room = await req(ctx, 'POST', '/rooms', { name: `Kassir xona ${Date.now()}` }, ctx.tokens.cashier);
    expect(room.status).toBe(201);
    const categories = await req(ctx, 'GET', '/categories', undefined, ctx.tokens.cashier);
    const product = await req(ctx, 'POST', '/products', {
      name: `Kassir mahsulot ${Date.now()}`,
      categoryId: categories.body[0].id,
      unit: 'PIECE',
      price: 1000,
      costPrice: 300,
    }, ctx.tokens.cashier);
    expect(product.status).toBe(201);
    expect(product.body.costPrice).toBe(300);
    const updated = await req(ctx, 'PATCH', `/products/${product.body.id}`, { costPrice: 350 }, ctx.tokens.cashier);
    expect(updated.status).toBe(200);
    expect(updated.body.costPrice).toBe(350);
    const cashier = employees.body.find((employee: { username: string }) => employee.username === 'kassir');
    const passwordUpdate = await req(ctx, 'PATCH', `/employees/${cashier.id}`, { password: 'cashier-login-123' }, ctx.tokens.owner);
    expect(passwordUpdate.status).toBe(200);
    const passwordLogin = await req(ctx, 'POST', '/auth/login', { username: 'kassir', password: 'cashier-login-123' });
    expect(passwordLogin.status).toBe(201);
    expect((await req(ctx, 'GET', '/reports/dashboard', undefined, passwordLogin.body.accessToken)).status).toBe(200);
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
    expect(typeof res.body.todayCostOfGoods).toBe('number');
    expect(typeof res.body.todayProfit).toBe('number');
    expect(typeof res.body.serviceFeeRevenueToday).toBe('number');
    expect(Array.isArray(res.body.revenueByDay)).toBe(true);
  });

  it('summary report subtracts expenses and product cost from revenue', async () => {
    const exp = await req(ctx, 'POST', '/expenses', { title: 'Test xarajat', amount: 25000, category: 'Test' }, ctx.tokens.owner);
    expect(exp.status).toBe(201);
    const res = await req(ctx, 'GET', '/reports/summary?from=2026-01-01&to=2026-12-31', undefined, ctx.tokens.owner);
    expect(res.status).toBe(200);
    expect(res.body.profit).toBe(res.body.revenue - res.body.expenses - res.body.costOfGoods);
    expect(res.body.expenses).toBeGreaterThanOrEqual(25000);
    expect(Array.isArray(res.body.paymentsByMethod)).toBe(true);
    expect(Array.isArray(res.body.employeePerformance)).toBe(true);
  });
});

describe('19. Owner clears test sales history', () => {
  it('waiter cannot clear sales history', async () => {
    const res = await req(ctx, 'POST', '/maintenance/clear-sales-history', {}, ctx.tokens.waiter);
    expect(res.status).toBe(403);
  });

  it('owner wipes orders, payments, deliveries and room sessions', async () => {
    const before = await req(ctx, 'GET', '/reports/dashboard', undefined, ctx.tokens.owner);
    expect(before.status).toBe(200);

    const res = await req(ctx, 'POST', '/maintenance/clear-sales-history', {}, ctx.tokens.owner);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.deleted.orders).toBeGreaterThan(0);

    const orders = await req(ctx, 'GET', '/orders', undefined, ctx.tokens.owner);
    expect(orders.status).toBe(200);
    expect(orders.body).toEqual([]);

    const deliveries = await req(ctx, 'GET', '/deliveries', undefined, ctx.tokens.owner);
    expect(deliveries.status).toBe(200);
    expect(deliveries.body).toEqual([]);

    const rooms = await req(ctx, 'GET', '/rooms', undefined, ctx.tokens.owner);
    expect(rooms.status).toBe(200);
    for (const room of rooms.body) expect(room.activeSession).toBeNull();

    const after = await req(ctx, 'GET', '/reports/dashboard', undefined, ctx.tokens.owner);
    expect(after.body.todayOrderCount).toBe(0);
    expect(after.body.todayRevenue).toBe(0);

    const audit = await req(ctx, 'GET', '/audit-logs?limit=5', undefined, ctx.tokens.owner);
    expect(audit.status).toBe(200);
    expect(audit.body[0].action).toBe('SALES_HISTORY_CLEARED');
  });

  it('keeps menu, staff, rooms and expenses intact', async () => {
    const products = await req(ctx, 'GET', '/products', undefined, ctx.tokens.owner);
    expect(products.status).toBe(200);
    expect(products.body.length).toBeGreaterThan(0);

    const employees = await req(ctx, 'GET', '/employees', undefined, ctx.tokens.owner);
    expect(employees.status).toBe(200);
    expect(employees.body.length).toBeGreaterThan(0);

    const rooms = await req(ctx, 'GET', '/rooms', undefined, ctx.tokens.owner);
    expect(rooms.body.length).toBeGreaterThan(0);

    const expenses = await req(ctx, 'GET', '/expenses', undefined, ctx.tokens.owner);
    expect(expenses.status).toBe(200);
  });
});
