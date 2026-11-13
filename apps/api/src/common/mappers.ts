import type { DeliveryDto, NotificationDto, OrderDto, OrderItemDto, PaymentDto } from '@ikki-dost/shared-types';
import type { Delivery, Notification, Order, OrderItem, Payment, PaymentMethod, Product, ProductImage, User } from '@prisma/client';

type OrderWithRelations = Order & {
  items: (OrderItem & { product?: (Product & { image?: ProductImage | null }) | null })[];
  delivery?: (Delivery & { assignedTo?: User | null }) | null;
  createdBy: User;
  roomSession?: { room: { name: string } } | null;
};

export function mapOrderItem(item: OrderItem & { product?: (Product & { image?: ProductImage | null }) | null }): OrderItemDto {
  return {
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    productName: item.productName,
    productUnit: item.productUnit,
    unitPrice: item.unitPrice,
    quantity: item.quantity.toString(),
    lineTotal: item.lineTotal,
    status: item.status,
    note: item.note,
    imageUrl: item.product?.image ? `/uploads/${item.product.image.thumbnailName ?? item.product.image.fileName}` : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

interface DeliveryOrderSummary {
  orderNumber: number;
  status: Order['status'];
  itemsTotal: number;
  totalAmount: number;
  paidAmount: number;
  note: string | null;
  items: (OrderItem & { product?: (Product & { image?: ProductImage | null }) | null })[];
}

type DeliveryWithOrder = Delivery & {
  assignedTo?: User | null;
  order?: DeliveryOrderSummary | null;
};

/**
 * Maps a delivery. When the delivery was loaded on its own, its `order`
 * relation must be included; when it is nested inside an order DTO the parent
 * order is passed as the second argument.
 */
export function mapDelivery(d: DeliveryWithOrder, parentOrder?: DeliveryOrderSummary): DeliveryDto {
  const order = d.order ?? parentOrder;
  if (!order) throw new Error('mapDelivery: order context is required');
  return {
    id: d.id,
    orderId: d.orderId,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    address: d.address,
    status: d.status,
    assignedToId: d.assignedToId,
    assignedToName: d.assignedTo?.fullName ?? null,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    itemsTotal: order.itemsTotal,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    outstandingAmount: Math.max(0, order.totalAmount - order.paidAmount),
    note: order.note,
    items: order.items.map(mapOrderItem),
    cashCollectedAmount: d.cashCollectedAmount ?? null,
    cashCollectedAt: d.cashCollectedAt?.toISOString() ?? null,
    cashHandedOverAt: d.cashHandedOverAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export function mapOrder(order: OrderWithRelations): OrderDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    roomId: order.roomId,
    roomName: order.roomSession?.room.name ?? null,
    roomSessionId: order.roomSessionId,
    numberOfPeople: order.numberOfPeople,
    note: order.note,
    items: order.items.map(mapOrderItem),
    delivery: order.delivery ? mapDelivery(order.delivery, order) : null,
    itemsTotal: order.itemsTotal,
    serviceFeeAmount: order.serviceFeeAmount,
    serviceFeePerPerson: order.serviceFeePerPerson,
    serviceFeeMethod: order.serviceFeeMethod,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    outstandingAmount: order.totalAmount - order.paidAmount,
    createdById: order.createdById,
    createdByName: order.createdBy.fullName,
    customerId: order.customerId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function mapPayment(p: Payment & { method: PaymentMethod; receivedBy: User }): PaymentDto {
  return {
    id: p.id,
    orderId: p.orderId,
    roomSessionId: p.roomSessionId,
    amount: p.amount,
    methodId: p.methodId,
    methodName: p.method.name,
    methodKind: p.method.kind,
    note: p.note,
    receivedById: p.receivedById,
    receivedByName: p.receivedBy.fullName,
    reversedAt: p.reversedAt?.toISOString() ?? null,
    reversalReason: null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function mapNotification(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown> | null) ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
