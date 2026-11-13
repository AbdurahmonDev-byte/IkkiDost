import { z } from 'zod';
import {
  DeliveryStatus,
  MeasurementUnit,
  OrderItemStatus,
  OrderType,
  PaymentKind,
  Role,
  ServiceFeeMethod,
} from '@ikki-dost/shared-types';

/** Positive integer UZS. */
export const uzsSchema = z.number().int().min(0);
export const positiveUzsSchema = z.number().int().positive();

/** Decimal quantity as string, e.g. "1", "0.750". */
export const quantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Miqdor noto‘g‘ri (masalan: 1 yoki 0.750)')
  .refine((v) => Number(v) > 0, 'Miqdor 0 dan katta bo‘lishi kerak');

// ===== Auth =====
export const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

// ===== Telegram authentication =====
/** Telegram WebApp initData string (validated server-side with BOT_TOKEN). */
export const telegramInitDataSchema = z.string().min(10).max(8192);

export const telegramAuthSchema = z.object({
  initData: telegramInitDataSchema,
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

/** Bot-only auto-login payload (requires X-Bot-Secret header). */
export const telegramBotAuthSchema = z.object({
  telegramId: z.string().regex(/^\d{4,20}$/),
});
export type TelegramBotAuthInput = z.infer<typeof telegramBotAuthSchema>;

export const telegramLinkSchema = z.object({
  initData: telegramInitDataSchema.optional(),
  /** Bot-only fallback (requires X-Bot-Secret header). */
  telegramId: z.string().regex(/^\d{4,20}$/).optional(),
  telegramUsername: z.string().max(64).optional().nullable(),
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
});
export type TelegramLinkInput = z.infer<typeof telegramLinkSchema>;

// ===== Customers (remote orders) =====
export const registerCustomerSchema = z.object({
  initData: telegramInitDataSchema.optional(),
  telegramId: z.string().regex(/^\d{4,20}$/).optional(),
  telegramUsername: z.string().max(64).optional().nullable(),
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  phone: z.string().min(7).max(32),
  deliveryAddress: z.string().min(3).max(500).optional().nullable(),
});
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;

export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(64).optional(),
  lastName: z.string().min(1).max(64).optional(),
  phone: z.string().min(7).max(32).optional(),
  deliveryAddress: z.string().min(3).max(500).optional().nullable(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/** Bot-only customer profile patch (the Telegram id comes from the bot). */
export const botUpdateCustomerSchema = updateCustomerSchema.extend({
  telegramId: z.string().regex(/^\d{4,20}$/),
});
export type BotUpdateCustomerInput = z.infer<typeof botUpdateCustomerSchema>;

export const botCustomerLookupSchema = z.object({
  telegramId: z.string().regex(/^\d{4,20}$/),
});
export type BotCustomerLookupInput = z.infer<typeof botCustomerLookupSchema>;

export const verifyPhoneSchema = z.object({
  telegramId: z.string().regex(/^\d{4,20}$/),
  phone: z.string().min(7).max(32),
  contactUserId: z.string().regex(/^\d{4,20}$/),
});
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;

// ===== Employees =====
export const createEmployeeSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, 'Faqat harf, raqam, _, ., -'),
  password: z.string().min(6).max(128),
  fullName: z.string().min(2).max(128),
  phone: z.string().max(32).optional().nullable(),
  role: z.nativeEnum(Role),
  canCreateDelivery: z.boolean().optional().default(false),
  telegramId: z.string().regex(/^\d{4,20}$/),
  telegramUsername: z.string().max(64).optional().nullable(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).max(128).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ===== Rooms =====
export const createRoomSchema = z.object({ name: z.string().min(1).max(64) });
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export const updateRoomSchema = z.object({ name: z.string().min(1).max(64).optional(), isActive: z.boolean().optional() });
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

// ===== Categories =====
export const createCategorySchema = z.object({ name: z.string().min(1).max(64), sortOrder: z.number().int().min(0).optional().default(0) });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ===== Products =====
export const createProductSchema = z.object({
  name: z.string().min(1).max(128),
  categoryId: z.string().min(1),
  unit: z.nativeEnum(MeasurementUnit),
  price: positiveUzsSchema,
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  categoryId: z.string().min(1).optional(),
  unit: z.nativeEnum(MeasurementUnit).optional(),
  price: positiveUzsSchema.optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'ARCHIVED']).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ===== Orders =====
export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: quantitySchema,
  note: z.string().max(500).optional().nullable(),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createDineInOrderSchema = z.object({
  type: z.literal(OrderType.DINE_IN),
  roomId: z.string().min(1),
  numberOfPeople: z.number().int().min(0).max(500),
  note: z.string().max(500).optional().nullable(),
  items: z.array(orderItemInputSchema).min(1),
});
export type CreateDineInOrderInput = z.infer<typeof createDineInOrderSchema>;

export const createDeliveryOrderSchema = z.object({
  type: z.literal(OrderType.DELIVERY),
  numberOfPeople: z.number().int().min(0).max(500),
  note: z.string().max(500).optional().nullable(),
  items: z.array(orderItemInputSchema).min(1),
  customerName: z.string().min(1).max(128),
  customerPhone: z.string().min(4).max(32),
  address: z.string().min(3).max(500),
  assignedToId: z.string().optional().nullable(),
});
export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;

export const createOrderSchema = z.discriminatedUnion('type', [createDineInOrderSchema, createDeliveryOrderSchema]);
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Public (Telegram Mini App) ordering is delivery-only. On-site guests must
 * call a waiter instead of placing a dine-in order from their phone.
 */
export const createPublicOrderSchema = z.object({
  type: z.literal(OrderType.DELIVERY),
  numberOfPeople: z.number().int().min(1).max(50).default(1),
  note: z.string().max(500).optional().nullable(),
  items: z.array(orderItemInputSchema).min(1),
  address: z.string().min(3).max(500),
  /** Optional; normally supplied via the X-Telegram-Init-Data header. */
  initData: z.string().min(10).max(8192).optional(),
});
export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;

export const addOrderItemsSchema = z.object({ items: z.array(orderItemInputSchema).min(1) });
export type AddOrderItemsInput = z.infer<typeof addOrderItemsSchema>;

export const updateOrderItemSchema = z.object({
  quantity: quantitySchema.optional(),
  note: z.string().max(500).optional().nullable(),
});
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;

export const cancelOrderSchema = z.object({ reason: z.string().min(2).max(500) });
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const itemStatusSchema = z.object({
  status: z.enum([OrderItemStatus.PREPARING, OrderItemStatus.READY, OrderItemStatus.SERVED]),
});
export type ItemStatusInput = z.infer<typeof itemStatusSchema>;

// ===== Delivery =====
export const updateDeliveryStatusSchema = z.object({
  status: z.nativeEnum(DeliveryStatus),
  /** Couriers record the cash they collected when marking a delivery delivered. */
  cashCollectedAmount: z.number().int().min(0).optional(),
});
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;

export const assignDeliverySchema = z.object({ assignedToId: z.string().min(1).nullable() });
export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>;

export const handoverDeliveryCashSchema = z.object({
  methodId: z.string().min(1).optional(),
  note: z.string().max(500).optional().nullable(),
});
export type HandoverDeliveryCashInput = z.infer<typeof handoverDeliveryCashSchema>;

// ===== Payments =====
export const createPaymentSchema = z.object({
  amount: positiveUzsSchema,
  methodId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  /** Idempotency key — client-generated UUID per payment attempt. */
  idempotencyKey: z.string().min(8).max(128).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const reversePaymentSchema = z.object({ reason: z.string().min(2).max(500) });
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;

export const closeSessionSchema = z.object({
  /** Required only for owner override when a balance remains. */
  overrideReason: z.string().min(3).max(500).optional(),
});
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

// ===== Payment methods =====
export const createPaymentMethodSchema = z.object({
  name: z.string().min(1).max(64),
  kind: z.nativeEnum(PaymentKind),
});
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export const updatePaymentMethodSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  kind: z.nativeEnum(PaymentKind).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

// ===== Expenses =====
export const createExpenseSchema = z.object({
  title: z.string().min(1).max(128),
  amount: positiveUzsSchema,
  category: z.string().max(64).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  spentAt: z.string().datetime().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ===== Service fee config =====
export const updateServiceFeeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  amountPerPerson: uzsSchema.optional(),
  applyToDineIn: z.boolean().optional(),
  applyToDelivery: z.boolean().optional(),
  method: z.nativeEnum(ServiceFeeMethod).optional(),
});
export type UpdateServiceFeeConfigInput = z.infer<typeof updateServiceFeeConfigSchema>;
