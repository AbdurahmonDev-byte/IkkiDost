import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { money, qty, unitShort } from '../format.js';
import { orderReceipt, receiptMessage } from '../receipt.js';
import { flowKey, type Deps, type OrderFlow } from '../state.js';
import type { CategoryDto, ProductDto, ServiceFeeConfigDto } from '../types.js';
import { expired } from './auth.js';
import { handleError, stale } from './rooms.js';

interface MenuCache {
  at: number;
  categories: CategoryDto[];
  products: ProductDto[];
  fee: ServiceFeeConfigDto | null;
}

let cache: MenuCache | null = null;
const CACHE_TTL = 60_000;

async function menuData(deps: Deps, chatId: number): Promise<MenuCache> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache;
  const fetcher = async (): Promise<MenuCache> => {
    const [categories, products, fee] = await Promise.all([
      api.categories(deps.config, deps.store, chatId),
      api.products(deps.config, deps.store, chatId),
      api.serviceFeeConfig(deps.config, deps.store, chatId).catch(() => null),
    ]);
    return { at: Date.now(), categories, products, fee };
  };
  cache = await fetcher();
  return cache;
}

export function invalidateMenuCache(): void {
  cache = null;
}

function feeFor(flow: OrderFlow, fee: ServiceFeeConfigDto | null): number {
  if (!fee || !fee.enabled) return 0;
  if (flow.mode === 'DINE_IN' && !fee.applyToDineIn) return 0;
  if (flow.mode === 'DELIVERY' && !fee.applyToDelivery) return 0;
  return flow.people > 0 ? flow.people * fee.amountPerPerson : 0;
}

function cartTotal(flow: OrderFlow, products: ProductDto[], fee: ServiceFeeConfigDto | null) {
  const items = Object.entries(flow.lines).reduce((sum, [productId, q]) => {
    const p = products.find((x) => x.id === productId);
    return p ? sum + Math.round(p.price * q) : sum;
  }, 0);
  const f = feeFor(flow, fee);
  return { items, fee: f, total: items + f, count: Object.keys(flow.lines).length };
}

function stepFor(p: ProductDto): number {
  return p.unit === 'KG' || p.unit === 'LITER' ? 0.25 : 1;
}

function cartLinesText(flow: OrderFlow, products: ProductDto[]): string {
  const rows: string[] = [];
  for (const [productId, q] of Object.entries(flow.lines)) {
    const p = products.find((x) => x.id === productId);
    if (p) rows.push(`• ${p.name} × ${qty(q, p.unit)} — ${money(Math.round(p.price * q))}`);
  }
  return rows.join('\n');
}

function modeTitle(flow: OrderFlow): string {
  if (flow.mode === 'DELIVERY') return '🛵 Yetkazish buyurtmasi';
  return flow.roomName ? `🪑 ${flow.roomName}` : '🍽 Zalda buyurtma';
}

// ===== Stage renderers (edit the wizard message when possible) =====

async function renderPeople(ctx: Context, flow: OrderFlow, edit: boolean) {
  const kb = new InlineKeyboard()
    .text('➖', 'o:p:-')
    .text(String(flow.people), 'o:p:n')
    .text('➕', 'o:p:+')
    .row()
    .text('Davom ▶️', 'o:p:d')
    .row()
    .text('❌ Bekor qilish', 'o:cancel');
  const text = `${modeTitle(flow)}\n\nNecha kishisiz? (xizmat haqi har bir kishi uchun hisoblanadi)`;
  if (edit) await ctx.editMessageText(text, { reply_markup: kb });
  else await ctx.reply(text, { reply_markup: kb });
}

async function renderMenu(deps: Deps, ctx: Context, flow: OrderFlow, edit: boolean) {
  const chatId = ctx.chat!.id;
  const data = await menuData(deps, chatId);
  const total = cartTotal(flow, data.products, data.fee);
  const kb = new InlineKeyboard();

  let text = `${modeTitle(flow)}\n`;
  if (total.count > 0) text += `\n🧺 Savat:\n${cartLinesText(flow, data.products)}\n\nJami: ${money(total.total)}\n`;

  if (!flow.categoryId) {
    text += '\nKategoriya tanlang:';
    for (const category of data.categories) {
      kb.text(category.name, `o:cat:${deps.refs.ref(chatId, category.id)}`).row();
    }
  } else {
    const category = data.categories.find((c) => c.id === flow.categoryId);
    text += `\n${category?.name ?? 'Menyu'} — taom tanlang:`;
    const products = data.products.filter((p) => p.categoryId === flow.categoryId && p.status === 'ACTIVE');
    if (products.length === 0) text += '\n(bu kategoriyada taom yo‘q)';
    for (const product of products) {
      const inCart = flow.lines[product.id];
      const label = `${product.name} — ${money(product.price)}/${unitShort[product.unit] || 'dona'}${inCart ? ` ✓${inCart}` : ''}`;
      kb.text(label, `o:prd:${deps.refs.ref(chatId, product.id)}`).row();
    }
    kb.text('⬅️ Kategoriyalar', 'o:back').row();
  }

  if (total.count > 0) kb.text(`✅ Buyurtmani yakunlash (${money(total.total)})`, 'o:done').row();
  kb.text('❌ Bekor qilish', 'o:cancel');

  if (edit) await ctx.editMessageText(text, { reply_markup: kb });
  else await ctx.reply(text, { reply_markup: kb });
}

async function renderQty(deps: Deps, ctx: Context, flow: OrderFlow, product: ProductDto, edit: boolean) {
  const chatId = ctx.chat!.id;
  const current = flow.lines[product.id] ?? 0;
  const step = stepFor(product);
  const shown = current > 0 ? current : step;
  const kb = new InlineKeyboard()
    .text('➖', 'o:q:-')
    .text(qty(shown, product.unit), 'o:q:n')
    .text('➕', 'o:q:+')
    .row()
    .text('✅ Savatga qo‘shish', 'o:q:d')
    .row()
    .text('⬅️ Orqaga', 'o:back');
  const text =
    `${product.name}\nNarxi: ${money(product.price)} / ${unitShort[product.unit] || 'dona'}\n\n` +
    `Miqdor: ${qty(shown, product.unit)} — ${money(Math.round(product.price * shown))}`;
  if (edit) await ctx.editMessageText(text, { reply_markup: kb });
  else await ctx.reply(text, { reply_markup: kb });
}

async function renderNote(ctx: Context, flow: OrderFlow, edit: boolean) {
  const kb = new InlineKeyboard().text('➡️ Izohsiz davom etish', 'o:note:skip').row().text('❌ Bekor qilish', 'o:cancel');
  const text = `${modeTitle(flow)}\n\n✍️ Oshpazga izoh yozing (ixtiyoriy).\nMisol: “achchiq bo‘lmasin”, “2 ta choy qaynoq”`;
  if (edit) await ctx.editMessageText(text, { reply_markup: kb });
  else await ctx.reply(text, { reply_markup: kb });
}

async function renderConfirm(deps: Deps, ctx: Context, flow: OrderFlow, edit: boolean) {
  const chatId = ctx.chat!.id;
  const data = await menuData(deps, chatId);
  const total = cartTotal(flow, data.products, data.fee);
  const kb = new InlineKeyboard();
  for (const productId of Object.keys(flow.lines)) {
    const p = data.products.find((x) => x.id === productId);
    if (p) kb.text(`✖ ${p.name}`, `o:rm:${deps.refs.ref(chatId, p.id)}`).row();
  }
  kb.text('✅ Tasdiqlash', 'o:ok').row().text('❌ Bekor qilish', 'o:cancel');

  let text = `${modeTitle(flow)}\n\n${cartLinesText(flow, data.products)}\n`;
  text += `\nTaomlar: ${money(total.items)}`;
  if (total.fee > 0) text += `\nXizmat haqi (${flow.people} kishi): ${money(total.fee)}`;
  text += `\n\nJAMI: ${money(total.total)}`;
  if (flow.roomName) text += `\nXona: ${flow.roomName}`;
  if (flow.customer) text += `\nMijoz: ${flow.customer.name} · ${flow.customer.phone}\nManzil: ${flow.customer.address}`;
  if (flow.note) text += `\nIzoh: ${flow.note}`;
  text += '\n\nTasdiqlaysizmi?';

  if (edit) await ctx.editMessageText(text, { reply_markup: kb });
  else await ctx.reply(text, { reply_markup: kb });
}

export async function renderStage(deps: Deps, ctx: Context, flow: OrderFlow, edit: boolean): Promise<void> {
  switch (flow.stage) {
    case 'people':
      return renderPeople(ctx, flow, edit);
    case 'menu':
      return renderMenu(deps, ctx, flow, edit);
    case 'qty': {
      const data = await menuData(deps, ctx.chat!.id);
      const product = data.products.find((p) => p.id === flow.currentProductId);
      if (!product) {
        flow.stage = 'menu';
        return renderMenu(deps, ctx, flow, edit);
      }
      return renderQty(deps, ctx, flow, product, edit);
    }
    case 'note':
      return renderNote(ctx, flow, edit);
    case 'confirm':
      return renderConfirm(deps, ctx, flow, edit);
  }
}

// ===== Wizard registration =====

export function registerOrder(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store, refs, flows } = deps;

  function getFlow(chatId: number): OrderFlow | undefined {
    const f = flows.get(flowKey(chatId));
    return f?.kind === 'order' ? f.data : undefined;
  }

  // Staff: start an order for a specific room (from the rooms screen).
  bot.callbackQuery(/^o:start:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'OWNER' && session.role !== 'WAITER') {
      return ctx.answerCallbackQuery({ text: 'Ruxsat yo‘q', show_alert: true });
    }
    const roomId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!roomId) return stale(ctx);
    try {
      const rooms = await api.rooms(config, store, ctx.chat.id);
      const room = rooms.find((r) => r.id === roomId);
      flows.set(flowKey(ctx.chat.id), {
        kind: 'order',
        data: {
          mode: 'DINE_IN',
          roomId,
          roomName: room?.name,
          people: 1,
          stage: 'people',
          lines: {},
        },
      });
      await ctx.answerCallbackQuery();
      await renderStage(deps, ctx, getFlow(ctx.chat.id)!, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // People stepper.
  bot.callbackQuery(/^o:p:([+\-nd])$/, async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    const op = ctx.match[1];
    if (op === '+') flow.people = Math.min(500, flow.people + 1);
    if (op === '-') flow.people = Math.max(0, flow.people - 1);
    await ctx.answerCallbackQuery();
    if (op === 'd') {
      flow.stage = 'menu';
      return renderMenu(deps, ctx, flow, true);
    }
    if (op === 'n') return;
    return renderStage(deps, ctx, flow, true);
  });

  // Category select.
  bot.callbackQuery(/^o:cat:(.+)$/, async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    const categoryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!categoryId) return stale(ctx);
    flow.categoryId = categoryId;
    await ctx.answerCallbackQuery();
    return renderMenu(deps, ctx, flow, true);
  });

  bot.callbackQuery('o:back', async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    flow.categoryId = undefined;
    flow.currentProductId = undefined;
    flow.stage = 'menu';
    await ctx.answerCallbackQuery();
    return renderMenu(deps, ctx, flow, true);
  });

  // Product select → qty stage.
  bot.callbackQuery(/^o:prd:(.+)$/, async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    const productId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!productId) return stale(ctx);
    flow.currentProductId = productId;
    flow.stage = 'qty';
    await ctx.answerCallbackQuery();
    return renderStage(deps, ctx, flow, true);
  });

  // Qty stepper.
  bot.callbackQuery(/^o:q:([+\-nd])$/, async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow || !flow.currentProductId) return stale(ctx);
    const data = await menuData(deps, ctx.chat.id);
    const product = data.products.find((p) => p.id === flow.currentProductId);
    if (!product) return stale(ctx);
    const step = stepFor(product);
    const op = ctx.match[1];
    const current = flow.lines[product.id] ?? 0;

    if (op === '+') flow.lines[product.id] = Number(((current || step) + step).toFixed(3));
    if (op === '-') {
      const next = Number(((current || step) - step).toFixed(3));
      if (next < step) delete flow.lines[product.id];
      else flow.lines[product.id] = next;
    }
    await ctx.answerCallbackQuery();
    if (op === 'd') {
      if (!flow.lines[product.id]) flow.lines[product.id] = step;
      flow.stage = 'menu';
      return renderMenu(deps, ctx, flow, true);
    }
    if (op === 'n') return;
    return renderQty(deps, ctx, flow, product, true);
  });

  // Cart finished → note.
  bot.callbackQuery('o:done', async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    if (Object.keys(flow.lines).length === 0) {
      return ctx.answerCallbackQuery({ text: 'Savat bo‘sh', show_alert: true });
    }
    flow.stage = 'note';
    await ctx.answerCallbackQuery();
    return renderNote(ctx, flow, true);
  });

  // Note skipped → advance.
  bot.callbackQuery('o:note:skip', async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    flow.note = undefined;
    await ctx.answerCallbackQuery();
    flow.stage = 'confirm';
    return renderConfirm(deps, ctx, flow, true);
  });

  // Remove a line from the cart (confirm screen).
  bot.callbackQuery(/^o:rm:(.+)$/, async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    const productId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (productId) delete flow.lines[productId];
    await ctx.answerCallbackQuery();
    if (Object.keys(flow.lines).length === 0) {
      flow.stage = 'menu';
      return renderMenu(deps, ctx, flow, true);
    }
    return renderConfirm(deps, ctx, flow, true);
  });

  // Cancel the whole wizard.
  bot.callbackQuery('o:cancel', async (ctx) => {
    flows.delete(flowKey(ctx.chat.id));
    await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
    await ctx.editMessageText('❌ Buyurtma bekor qilindi.');
  });

  // Confirm → create the order.
  bot.callbackQuery('o:ok', async (ctx) => {
    const flow = getFlow(ctx.chat.id);
    if (!flow) return stale(ctx);
    const chatId = ctx.chat.id;
    if (Object.keys(flow.lines).length === 0) {
      return ctx.answerCallbackQuery({ text: 'Savat bo‘sh', show_alert: true });
    }
    await ctx.answerCallbackQuery({ text: 'Yuborilmoqda…' });

    const items = Object.entries(flow.lines).map(([productId, quantity]) => ({
      productId,
      quantity: String(quantity),
      note: null,
    }));

    try {
      let order;
      if (flow.mode === 'DINE_IN') {
        order = await api.createDineInOrder(config, store, chatId, {
          roomId: flow.roomId!,
          numberOfPeople: flow.people,
          items,
          note: flow.note ?? null,
        });
      } else {
        order = await api.createDeliveryOrder(config, store, chatId, {
          numberOfPeople: flow.people,
          items,
          customerName: flow.customer!.name,
          customerPhone: flow.customer!.phone,
          address: flow.customer!.address,
          note: flow.note ?? null,
        });
      }

      flows.delete(flowKey(chatId));
      const receipt = orderReceipt(order as import('../types.js').OrderDto, { roomName: flow.roomName });

      await ctx.editMessageText(
        `✅ Buyurtma #${(order as import('../types.js').OrderDto).orderNumber} qabul qilindi va oshpazga yuborildi!`,
      );
      await ctx.reply(receiptMessage(receipt), { parse_mode: 'HTML' });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });
}

/** Called by the text router when the wizard waits for a chef note. */
export async function handleNoteText(deps: Deps, ctx: Context, flow: OrderFlow, text: string): Promise<void> {
  flow.note = text.trim().slice(0, 300) || undefined;
  flow.stage = 'confirm';
  return renderConfirm(deps, ctx, flow, false);
}

export async function startDeliveryWizard(deps: Deps, ctx: Context, customer: { name: string; phone: string; address: string }): Promise<void> {
  const flow: OrderFlow = {
    mode: 'DELIVERY',
    customer,
    people: 1,
    stage: 'people',
    lines: {},
  };
  deps.flows.set(flowKey(ctx.chat!.id), { kind: 'order', data: flow });
  await renderPeople(ctx, flow, false);
}

export function getOrderFlow(deps: Deps, chatId: number): OrderFlow | undefined {
  const f = deps.flows.get(flowKey(chatId));
  return f?.kind === 'order' ? f.data : undefined;
}
