import { Injectable } from '@nestjs/common';
import type { DashboardSummaryDto, ReportDto } from '@ikki-dost/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async dashboard(): Promise<DashboardSummaryDto> {
    const today = startOfDay(new Date());
    const [todayPayments, todayOrders, activeRooms, activeDineIn, activeDelivery, openSessions, todayFeeOrders, todayExpenses, topProducts, recentActivity, weekPayments, weekExpenses] =
      await Promise.all([
        this.prisma.payment.aggregate({ where: { createdAt: { gte: today }, reversedAt: null }, _sum: { amount: true } }),
        this.prisma.order.count({ where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } } }),
        this.prisma.roomSession.count({ where: { status: 'OPEN' } }),
        this.prisma.order.count({ where: { type: 'DINE_IN', status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY', 'SERVED'] } } }),
        this.prisma.order.count({ where: { type: 'DELIVERY', status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY', 'SERVED'] } } }),
        this.prisma.roomSession.findMany({ where: { status: 'OPEN' }, select: { totalAmount: true, paidAmount: true } }),
        this.prisma.order.aggregate({ where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } }, _sum: { serviceFeeAmount: true } }),
        this.prisma.expense.aggregate({ where: { spentAt: { gte: today } }, _sum: { amount: true } }),
        this.prisma.orderItem.groupBy({
          by: ['productName'],
          where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } },
          _sum: { lineTotal: true, quantity: true },
          orderBy: { _sum: { lineTotal: 'desc' } },
          take: 5,
        }),
        this.audit.findAll(10),
        this.prisma.payment.findMany({ where: { createdAt: { gte: new Date(today.getTime() - 6 * 86400_000) }, reversedAt: null }, select: { amount: true, createdAt: true } }),
        this.prisma.expense.findMany({ where: { spentAt: { gte: new Date(today.getTime() - 6 * 86400_000) } }, select: { amount: true, spentAt: true } }),
      ]);

    const paidToday = todayPayments._sum.amount ?? 0;
    const unpaidOutstanding = openSessions.reduce((s, x) => s + (x.totalAmount - x.paidAmount), 0);

    const byDay = new Map<string, { revenue: number; expenses: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(new Date(today.getTime() - i * 86400_000)).toISOString().slice(0, 10);
      byDay.set(d, { revenue: 0, expenses: 0 });
    }
    for (const p of weekPayments) {
      const key = startOfDay(p.createdAt).toISOString().slice(0, 10);
      const cur = byDay.get(key);
      if (cur) cur.revenue += p.amount;
    }
    for (const e of weekExpenses) {
      const key = startOfDay(e.spentAt).toISOString().slice(0, 10);
      const cur = byDay.get(key);
      if (cur) cur.expenses += e.amount;
    }

    return {
      todayRevenue: paidToday,
      todayOrderCount: todayOrders,
      activeRooms,
      activeDineInOrders: activeDineIn,
      activeDeliveryOrders: activeDelivery,
      paidToday,
      unpaidOutstanding,
      serviceFeeRevenueToday: todayFeeOrders._sum.serviceFeeAmount ?? 0,
      todayExpenses: todayExpenses._sum.amount ?? 0,
      popularProducts: topProducts.map((p) => ({ productName: p.productName, quantity: String(p._sum.quantity ?? 0), revenue: p._sum.lineTotal ?? 0 })),
      recentActivity,
      revenueByDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    };
  }

  /** Full financial report for a date range. Profit = revenue − expenses. */
  async summary(from: string, to: string): Promise<ReportDto> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error('Sana formati noto‘g‘ri');
    }

    const [payments, expenses, orders, paymentsByMethod, topProducts, waiterOrders] = await Promise.all([
      this.prisma.payment.aggregate({ where: { createdAt: { gte: fromDate, lte: toDate }, reversedAt: null }, _sum: { amount: true } }),
      this.prisma.expense.aggregate({ where: { spentAt: { gte: fromDate, lte: toDate } }, _sum: { amount: true } }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
        select: { type: true, totalAmount: true, serviceFeeAmount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['methodId'],
        where: { createdAt: { gte: fromDate, lte: toDate }, reversedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        where: { createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
        _sum: { lineTotal: true, quantity: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10,
      }),
      this.prisma.order.groupBy({
        by: ['createdById'],
        where: { createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { totalAmount: true },
      }),
    ]);

    const methodIds = paymentsByMethod.map((m) => m.methodId);
    const methods = await this.prisma.paymentMethod.findMany({ where: { id: { in: methodIds } } });
    const methodById = new Map(methods.map((m) => [m.id, m]));

    const userIds = waiterOrders.map((w) => m_id(w));
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    const userById = new Map(users.map((u) => [u.id, u]));

    const revenue = payments._sum.amount ?? 0;
    const expenseTotal = expenses._sum.amount ?? 0;

    function m_id(w: { createdById: string }) {
      return w.createdById;
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      revenue,
      expenses: expenseTotal,
      profit: revenue - expenseTotal,
      serviceFeeTotal: orders.reduce((s, o) => s + o.serviceFeeAmount, 0),
      orderCount: orders.length,
      dineInRevenue: orders.filter((o) => o.type === 'DINE_IN').reduce((s, o) => s + o.totalAmount, 0),
      deliveryRevenue: orders.filter((o) => o.type === 'DELIVERY').reduce((s, o) => s + o.totalAmount, 0),
      paymentsByMethod: paymentsByMethod.map((m) => ({
        methodName: methodById.get(m.methodId)?.name ?? 'Noma’lum',
        kind: methodById.get(m.methodId)?.kind ?? 'OTHER',
        amount: m._sum.amount ?? 0,
        count: m._count,
      })),
      topProducts: topProducts.map((p) => ({ productName: p.productName, quantity: String(p._sum.quantity ?? 0), revenue: p._sum.lineTotal ?? 0 })),
      employeePerformance: waiterOrders.map((w) => ({
        employeeName: userById.get(w.createdById)?.fullName ?? 'Noma’lum',
        role: userById.get(w.createdById)?.role ?? 'WAITER',
        ordersCreated: w._count,
        revenueHandled: w._sum.totalAmount ?? 0,
      })),
    };
  }
}
