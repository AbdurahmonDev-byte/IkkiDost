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

export function mapDelivery(d: Delivery & { assignedTo?: User | null }): DeliveryDto {
  return {
    id: d.id,
    orderId: d.orderId,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    address: d.address,
    status: d.status,
    assignedToId: d.assignedToId,
    assignedToName: d.assignedTo?.fullName ?? null,
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
    delivery: order.delivery ? mapDelivery(order.delivery) : null,
    itemsTotal: order.itemsTotal,
    serviceFeeAmount: order.serviceFeeAmount,
    serviceFeePerPerson: order.serviceFeePerPerson,
    serviceFeeMethod: order.serviceFeeMethod,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    outstandingAmount: order.totalAmount - order.paidAmount,
    createdById: order.createdById,
    createdByName: order.createdBy.fullName,
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
