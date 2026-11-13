import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Camera,
  CheckCircle2,
  FolderPlus,
  ImagePlus,
  Loader2,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
  Users,
  Power,
} from 'lucide-react';
import { api } from '../lib/api';
import { money, qty } from '../lib/format';
import { tg } from '../lib/telegram';
import type { Category, MeasurementUnit, Product, Role } from '../lib/types';

interface Props {
  token: string;
  /** Refresh the public menu after products change. */
  onMenuChanged?: () => void;
}

interface Stats {
  todayRevenue: number;
  todayOrderCount: number;
  activeRooms: number;
  activeDineInOrders: number;
  activeDeliveryOrders: number;
  paidToday: number;
  unpaidOutstanding: number;
  popularProducts: Array<{ productName: string; quantity: string; revenue: number }>;
}

interface EmployeeAccess {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  telegramId: string | null;
  isActive: boolean;
}

const roleName: Record<Role, string> = {
  OWNER: 'Egasi',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
  DELIVERY: 'Yetkazuvchi',
};
const STAFF_ROLES: Role[] = ['WAITER', 'CHEF', 'CASHIER', 'DELIVERY'];
const ROLE_OPTIONS: Role[] = ['OWNER', ...STAFF_ROLES];

const UNITS: MeasurementUnit[] = ['PIECE', 'PORTION', 'KG', 'LITER', 'OTHER'];
const unitLabel: Record<MeasurementUnit, string> = {
  PIECE: 'Dona',
  PORTION: 'Porsiya',
  KG: 'Kilogramm',
  LITER: 'Litr',
  OTHER: 'Boshqa',
};

function parsePrice(value: string): number {
  return Number(value.replace(/[^\d]/g, '')) || 0;
}

export const OwnerScreen: React.FC<Props> = ({ token, onMenuChanged }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<EmployeeAccess[]>([]);
  const [telegramIds, setTelegramIds] = useState<Record<string, string>>({});
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeTelegramId, setNewEmployeeTelegramId] = useState('');
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState<Role>('WAITER');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New product form
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState<MeasurementUnit>('PORTION');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, c, p, staff] = await Promise.all([
        api.getDashboard(token),
        api.getCategories(token),
        api.getProducts(token, true),
        api.getEmployees(token),
      ]);
      setStats(s);
      setCategories(c);
      setProducts(p);
      const activeStaff = staff.filter((employee) => employee.username !== 'bot');
      setEmployees(activeStaff);
      setTelegramIds(Object.fromEntries(activeStaff.map((employee) => [employee.id, employee.telegramId ?? ''])));
      if (!categoryId && c.length > 0) setCategoryId(c[0].id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ma’lumotlarni yuklab bo‘lmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2500);
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parsePrice(price);
    if (!name.trim() || !categoryId || amount <= 0) {
      setError('Nom, kategoriya va narxni to‘ldiring');
      return;
    }
    setBusy('create');
    setError(null);
    try {
      const product = await api.createProduct(token, {
        name: name.trim(),
        categoryId,
        unit,
        price: amount,
      });
      if (imageFile) {
        await api.uploadProductImage(token, product.id, imageFile);
      }
      setName('');
      setPrice('');
      setImageFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await fetchAll(true);
      onMenuChanged?.();
      tg.hapticSuccess();
      flash('Taom qo‘shildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Taomni qo‘shib bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (product: Product, file: File) => {
    setBusy(`img-${product.id}`);
    setError(null);
    try {
      const updated = await api.uploadProductImage(token, product.id, file);
      setProducts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      onMenuChanged?.();
      tg.hapticSuccess();
      flash('Rasm yangilandi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rasmni yuklab bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (product: Product) => {
    setBusy(`img-${product.id}`);
    setError(null);
    try {
      const updated = await api.removeProductImage(token, product.id);
      setProducts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      onMenuChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rasmni o‘chirib bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = async (product: Product) => {
    setBusy(`st-${product.id}`);
    setError(null);
    try {
      const updated = await api.updateProduct(token, product.id, {
        status: product.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      });
      setProducts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      onMenuChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Holatni o‘zgartirib bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setBusy('cat');
    setError(null);
    try {
      const created = await api.createCategory(token, {
        name: newCategory.trim(),
        sortOrder: categories.length,
      });
      setCategories((rows) => [...rows, created]);
      setCategoryId(created.id);
      setNewCategory('');
      flash('Kategoriya qo‘shildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kategoriya qo‘shib bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const assignTelegramId = async (employee: EmployeeAccess) => {
    const telegramId = telegramIds[employee.id]?.trim() ?? '';
    if (!/^\d{4,20}$/.test(telegramId)) {
      setError('Telegram ID 4–20 ta raqamdan iborat bo‘lishi kerak');
      return;
    }
    setBusy(`tg-${employee.id}`);
    setError(null);
    try {
      const updated = await api.updateEmployeeTelegramId(token, employee.id, telegramId);
      setEmployees((rows) => rows.map((row) => row.id === employee.id ? { ...row, telegramId: updated.telegramId } : row));
      tg.hapticSuccess();
      flash(`${employee.fullName} uchun Telegram ID saqlandi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Telegram ID saqlanmadi');
    } finally {
      setBusy(null);
    }
  };

  /** Owner can change a staff member's role or deactivate/reactivate them. */
  const patchEmployee = async (
    employee: EmployeeAccess,
    patch: { role?: Role; isActive?: boolean },
  ) => {
    setBusy(`emp-${employee.id}`);
    setError(null);
    try {
      const updated = await api.updateEmployee(token, employee.id, patch);
      setEmployees((rows) =>
        rows.map((row) =>
          row.id === employee.id
            ? { ...row, role: updated.role, isActive: updated.isActive }
            : row,
        ),
      );
      tg.hapticSuccess();
      flash(
        patch.role
          ? `${employee.fullName} roli: ${roleName[updated.role]}`
          : updated.isActive
            ? `${employee.fullName} faollashtirildi`
            : `${employee.fullName} faolsizlantirildi`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xodimni yangilab bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const createEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = newEmployeeName.trim();
    const telegramId = newEmployeeTelegramId.trim();
    if (fullName.length < 2 || !/^\d{4,20}$/.test(telegramId)) {
      setError('Xodim ismini va to‘g‘ri Telegram ID ni kiriting');
      return;
    }
    setBusy('employee-create');
    setError(null);
    try {
      const employee = await api.createEmployee(token, {
        username: `staff_${telegramId}`,
        password: crypto.randomUUID(),
        fullName,
        phone: newEmployeePhone.trim() || null,
        role: newEmployeeRole,
        telegramId,
      });
      setEmployees((rows) => [employee, ...rows]);
      setTelegramIds((rows) => ({ ...rows, [employee.id]: telegramId }));
      setNewEmployeeName('');
      setNewEmployeeTelegramId('');
      setNewEmployeePhone('');
      setNewEmployeeRole('WAITER');
      tg.hapticSuccess();
      flash(`${employee.fullName} · ${roleName[employee.role]} qo‘shildi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xodimni qo‘shib bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-purple-700 to-indigo-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight">Egasi paneli</h2>
            <p className="text-xs text-purple-200">Bugungi ko‘rsatkichlar va menyu</p>
          </div>
        </div>
        <button
          onClick={() => fetchAll()}
          className="rounded-2xl bg-white/10 p-2.5 active:scale-95 transition-all"
          title="Yangilash"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Bugungi savdo', value: stats ? money(stats.todayRevenue) : '—', accent: true },
          { label: 'Buyurtmalar', value: stats ? `${stats.todayOrderCount} ta` : '—' },
          { label: 'Faol xonalar', value: stats ? `${stats.activeRooms} ta` : '—' },
          { label: 'Yetkazishlar', value: stats ? `${stats.activeDeliveryOrders} ta` : '—' },
          {
            label: 'To‘langan',
            value: stats ? money(stats.paidToday) : '—',
          },
          {
            label: 'Qarzdorlik',
            value: stats ? money(stats.unpaidOutstanding) : '—',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-3.5 shadow-sm ${
              card.accent
                ? 'border-brand-200 bg-brand-50'
                : 'border-stone-200/80 bg-white'
            }`}
          >
            <p className="text-[11px] font-semibold text-stone-500">{card.label}</p>
            <p className="mt-1 text-base font-black text-stone-900">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900">Xodimlarning Telegram ID lari</h3>
            <p className="text-[11px] text-stone-500">ID rolni aniqlaydi; xodimlar parol bilan kirmaydi.</p>
          </div>
        </div>
        <form onSubmit={createEmployee} className="mb-2 grid gap-2 border-b border-stone-100 pb-4 sm:grid-cols-2">
          <input
            value={newEmployeeName}
            onChange={(event) => setNewEmployeeName(event.target.value)}
            placeholder="Xodim ism-familiyasi"
            aria-label="Xodim ism-familiyasi"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-sky-400"
          />
          <input
            value={newEmployeeTelegramId}
            onChange={(event) => setNewEmployeeTelegramId(event.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Telegram ID"
            aria-label="Yangi xodim Telegram ID"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-sky-400"
          />
          <input
            value={newEmployeePhone}
            onChange={(event) => setNewEmployeePhone(event.target.value)}
            inputMode="tel"
            placeholder="Telefon (ixtiyoriy)"
            aria-label="Xodim telefoni"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-sky-400"
          />
          <div className="flex gap-2">
            <select
              value={newEmployeeRole}
              onChange={(event) => setNewEmployeeRole(event.target.value as Role)}
              aria-label="Xodim roli"
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-sky-400"
            >
              {STAFF_ROLES.map((role) => <option key={role} value={role}>{roleName[role]}</option>)}
            </select>
            <button
              type="submit"
              disabled={busy === 'employee-create' || newEmployeeName.trim().length < 2 || !/^\d{4,20}$/.test(newEmployeeTelegramId)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {busy === 'employee-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Qo‘shish
            </button>
          </div>
        </form>
        <div className="divide-y divide-stone-100">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className={`space-y-2 py-3 ${employee.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-stone-900">{employee.fullName}</p>
                  <p className="text-[10px] text-stone-500">
                    {roleName[employee.role]}
                    {!employee.isActive ? ' · Faolsiz' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => patchEmployee(employee, { isActive: !employee.isActive })}
                  disabled={busy === `emp-${employee.id}`}
                  title={employee.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold disabled:opacity-40 ${
                    employee.isActive
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {busy === `emp-${employee.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Power className="h-3.5 w-3.5" />
                  )}
                  {employee.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={employee.role}
                  onChange={(event) =>
                    patchEmployee(employee, { role: event.target.value as Role })
                  }
                  disabled={busy === `emp-${employee.id}`}
                  aria-label={`${employee.fullName} roli`}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-sky-400 disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{roleName[role]}</option>
                  ))}
                </select>
                <input
                  value={telegramIds[employee.id] ?? ''}
                  onChange={(event) => setTelegramIds((rows) => ({ ...rows, [employee.id]: event.target.value.replace(/\D/g, '') }))}
                  inputMode="numeric"
                  aria-label={`${employee.fullName} Telegram ID`}
                  placeholder="Telegram ID"
                  className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() => assignTelegramId(employee)}
                  disabled={busy === `tg-${employee.id}` || !/^\d{4,20}$/.test(telegramIds[employee.id] ?? '')}
                  title="Telegram ID ni saqlash"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white disabled:opacity-40"
                >
                  {busy === `tg-${employee.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          {employees.length === 0 && !loading && (
            <p className="py-4 text-xs text-stone-500">Faol xodim topilmadi.</p>
          )}
        </div>
        <p className="mt-2 flex items-start gap-1.5 border-t border-stone-100 pt-3 text-[10px] leading-relaxed text-stone-500">
          <KeyRound className="mt-0.5 h-3 w-3 shrink-0" /> Xodim botda /start bosganda ID si chiqadi. ID’ni shu yerga kiriting;
          keyin u qayta /start bossa, roli bo‘yicha avtomatik kiradi.
        </p>
      </section>

      {/* Add product */}
      <div className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <ImagePlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900">Yangi taom qo‘shish</h3>
            <p className="text-[11px] text-stone-500">Nomi, narxi va rasmni kiriting</p>
          </div>
        </div>

        <form onSubmit={createProduct} className="space-y-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Taom nomi (masalan: Osh)"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:bg-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:bg-white"
            >
              <option value="">Kategoriya</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:bg-white"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel[u]}
                </option>
              ))}
            </select>
          </div>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Narxi (so‘m)"
            inputMode="numeric"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:bg-white"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-2.5 text-xs font-semibold text-stone-500">
            <Camera className="h-4 w-4" />
            <span className="truncate">{imageFile ? imageFile.name : 'Taom rasmi (ixtiyoriy)'}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="submit"
            disabled={busy === 'create'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Taom qo‘shish
          </button>
        </form>

        <form onSubmit={addCategory} className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Yangi kategoriya"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold outline-none focus:border-brand-400 focus:bg-white"
          />
          <button
            type="submit"
            disabled={busy === 'cat'}
            className="flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === 'cat' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
            Qo‘shish
          </button>
        </form>
      </div>

      {/* Products */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-stone-400">
            Menyu ({products.length})
          </h3>
        </div>

        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-xs">Yuklanmoqda...</span>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                {product.thumbnailUrl || product.imageUrl ? (
                  <img
                    src={product.thumbnailUrl || product.imageUrl || ''}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Utensils className="h-5 w-5 text-stone-300" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-stone-900">{product.name}</p>
                  {product.status !== 'ACTIVE' && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-stone-500">
                      o‘chiq
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  {money(product.price)} · {qty(1, product.unit)}
                </p>
                <div className="mt-1 flex gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
                    {busy === `img-${product.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                    Rasm
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhoto(product, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {(product.imageUrl || product.thumbnailUrl) && (
                    <button
                      onClick={() => removePhoto(product)}
                      className="rounded-lg bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleStatus(product)}
                    disabled={busy === `st-${product.id}`}
                    className="rounded-lg bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600 disabled:opacity-50"
                  >
                    {product.status === 'ACTIVE' ? 'O‘chirish' : 'Yoqish'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {stats && stats.popularProducts.length > 0 && (
        <div className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-stone-400">
            Eng ko‘p sotilganlar
          </h3>
          <div className="space-y-1.5">
            {stats.popularProducts.slice(0, 5).map((p) => (
              <div key={p.productName} className="flex items-center justify-between text-xs">
                <span className="truncate font-semibold text-stone-700">{p.productName}</span>
                <span className="shrink-0 font-black text-stone-900">{money(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
