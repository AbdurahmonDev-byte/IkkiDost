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
  Save,
  Trash2,
  TriangleAlert,
  Utensils,
  Users,
  Power,
} from 'lucide-react';
import { api } from '../lib/api';
import { money, qty } from '../lib/format';
import { tg } from '../lib/telegram';
import type { Category, MeasurementUnit, Product, Role } from '../lib/types';
import { StaffHeader } from './StaffHeader';
import { OptimoDashboard, type OptimoStats } from './OptimoDashboard';

interface Props {
  token: string;
  /** Refresh the public menu after products change. */
  onMenuChanged?: () => void;
}

type Stats = OptimoStats;


interface EmployeeAccess {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  telegramId: string | null;
  isActive: boolean;
}

const roleName: Record<Role, string> = {
  OWNER: 'Ega',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
  DELIVERY: 'Yetkazuvchi',
};
const roleHint: Record<Role, string> = {
  OWNER: 'Barcha bo‘limlar va sozlamalar',
  WAITER: 'Xonalar va buyurtmalar',
  CHEF: 'Oshxona navbati',
  CASHIER: 'To‘lovlar va naqd pul',
  DELIVERY: 'Yetkazish va mijoz aloqasi',
};
const STAFF_ROLES: Role[] = ['WAITER', 'CHEF', 'CASHIER', 'DELIVERY'];
const ROLE_OPTIONS: Role[] = ['OWNER', ...STAFF_ROLES];

type OwnerSection = 'overview' | 'staff' | 'menu';

const OWNER_SECTIONS: Array<{
  id: OwnerSection;
  label: string;
  hint: string;
  icon: typeof BarChart3;
}> = [
  {
    id: 'overview',
    label: 'Hisobot',
    hint: 'Bugungi savdo, buyurtmalar va qarzdorlik.',
    icon: BarChart3,
  },
  {
    id: 'staff',
    label: 'Xodimlar',
    hint: 'Telegram ID biriktiring, rolini o‘zgartiring yoki faolsizlantiring.',
    icon: Users,
  },
  {
    id: 'menu',
    label: 'Menyu',
    hint: 'Yangi taom, kategoriya va rasmlarni boshqaring.',
    icon: Utensils,
  },
];

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
  const [section, setSection] = useState<OwnerSection>('overview');
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
  const [confirmClear, setConfirmClear] = useState(false);

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

  const clearSalesHistory = async () => {
    setBusy('clear-sales');
    setError(null);
    try {
      const res = await api.clearSalesHistory(token);
      setConfirmClear(false);
      tg.hapticSuccess();
      await fetchAll(true);
      flash(
        `Tozalandi: ${res.deleted.orders ?? 0} buyurtma, ${res.deleted.payments ?? 0} to‘lov`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ma’lumotlarni tozalab bo‘lmadi');
    } finally {
      setBusy(null);
    }
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
      <StaffHeader
        icon={BarChart3}
        eyebrow="Ega paneli"
        title="Boshqaruv markazi"
        subtitle="Xodimlar, menyu va bugungi ko‘rsatkichlar"
        tone="purple"
        onRefresh={() => fetchAll()}
        loading={loading}
      />

      <div className="grid grid-cols-3 gap-1.5 rounded-[24px] border border-stone-200/60 dark:border-stone-800/60 bg-white/80 dark:bg-stone-900/80 p-1.5 shadow-sm backdrop-blur">
        {OWNER_SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                tg.selection();
                setSection(item.id);
              }}
              className={`tap flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-bold ${
                active
                  ? 'bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg shadow-violet-600/25'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-start gap-2 rounded-2xl border border-violet-100 dark:border-violet-400/25 bg-violet-50/70 dark:bg-violet-400/10 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-violet-900 dark:text-violet-200">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span>{OWNER_SECTIONS.find((item) => item.id === section)?.hint}</span>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-400/25 bg-rose-50 dark:bg-rose-400/10 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Stats — Optimo Dashboard */}
      {section === 'overview' && (
        <div className="space-y-3 animate-rise">
          {stats ? (
            <OptimoDashboard stats={stats} title="Ega — Asosiy hisobot" />
          ) : (
            <div className="surface flex items-center justify-center py-16 text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              <span className="ml-2 text-xs font-semibold">Yuklanmoqda...</span>
            </div>
          )}
        </div>
      )}


      {section === 'staff' && (
        <section className="surface p-4 animate-rise">
        <div className="mb-3 flex items-start gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-600/25">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">Xodimlar va rollar</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
              Telegram ID rolni aniqlaydi. Xodimlar parolsiz, ID orqali kiradi.
            </p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 p-2.5">
          {STAFF_ROLES.map((role) => (
            <div key={role} className="rounded-xl bg-white/80 dark:bg-stone-900/80 px-2.5 py-2">
              <p className="text-[10.5px] font-black text-stone-800 dark:text-stone-200">{roleName[role]}</p>
              <p className="text-[9.5px] font-medium leading-tight text-stone-500">{roleHint[role]}</p>
            </div>
          ))}
        </div>
        <form onSubmit={createEmployee} className="mb-4 grid gap-2.5 border-b border-stone-100 dark:border-stone-800 pb-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="label-mini">Ism-familiya</span>
            <input
              value={newEmployeeName}
              onChange={(event) => setNewEmployeeName(event.target.value)}
              placeholder="Masalan: Ali Valiyev"
              aria-label="Xodim ism-familiyasi"
              className="field-mini"
            />
          </label>
          <label className="space-y-1">
            <span className="label-mini">Telegram ID</span>
            <input
              value={newEmployeeTelegramId}
              onChange={(event) => setNewEmployeeTelegramId(event.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="Masalan: 123456789"
              aria-label="Yangi xodim Telegram ID"
              className="field-mini"
            />
          </label>
          <label className="space-y-1">
            <span className="label-mini">Telefon (ixtiyoriy)</span>
            <input
              value={newEmployeePhone}
              onChange={(event) => setNewEmployeePhone(event.target.value)}
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              aria-label="Xodim telefoni"
              className="field-mini"
            />
          </label>
          <label className="space-y-1">
            <span className="label-mini">Rol</span>
            <select
              value={newEmployeeRole}
              onChange={(event) => setNewEmployeeRole(event.target.value as Role)}
              aria-label="Xodim roli"
              className="field-mini"
            >
              {STAFF_ROLES.map((role) => <option key={role} value={role}>{roleName[role]}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy === 'employee-create' || newEmployeeName.trim().length < 2 || !/^\d{4,20}$/.test(newEmployeeTelegramId)}
            className="btn-primary py-3 text-xs disabled:opacity-40 sm:col-span-2"
          >
            {busy === 'employee-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Xodim qo‘shish
          </button>
        </form>
        <div className="space-y-2.5">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className={`rounded-2xl border border-stone-200/70 dark:border-stone-800/70 bg-stone-50/60 dark:bg-stone-800/50 p-3.5 ${
                employee.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-stone-800 to-stone-950 text-[11px] font-black text-white">
                    {employee.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-stone-900 dark:text-stone-100">{employee.fullName}</p>
                    <p className="truncate text-[10px] font-medium text-stone-500 dark:text-stone-400">
                      {roleName[employee.role]} · {roleHint[employee.role]}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`chip ${
                      employee.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        employee.isActive ? 'bg-emerald-500' : 'bg-stone-400'
                      }`}
                    />
                    {employee.isActive ? 'Faol' : 'Faolsiz'}
                  </span>
                  <button
                    type="button"
                    onClick={() => patchEmployee(employee, { isActive: !employee.isActive })}
                    disabled={busy === `emp-${employee.id}`}
                    title={employee.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}
                    className={`tap flex h-8 w-8 items-center justify-center rounded-xl disabled:opacity-40 ${
                      employee.isActive
                        ? 'bg-rose-50 dark:bg-rose-400/10 text-rose-600'
                        : 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600'
                    }`}
                  >
                    {busy === `emp-${employee.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,108px)_1fr_auto] items-end gap-1.5">
                <label className="space-y-1">
                  <span className="px-1 text-[9px] font-bold uppercase tracking-wide text-stone-500">
                    Rol
                  </span>
                  <select
                    value={employee.role}
                    onChange={(event) =>
                      patchEmployee(employee, { role: event.target.value as Role })
                    }
                    disabled={busy === `emp-${employee.id}`}
                    aria-label={`${employee.fullName} roli`}
                    className="w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-2 py-2 text-[11px] font-bold text-stone-800 dark:text-stone-200 outline-none focus:border-brand-400 disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{roleName[role]}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="px-1 text-[9px] font-bold uppercase tracking-wide text-stone-500">
                    Telegram ID
                  </span>
                  <input
                    value={telegramIds[employee.id] ?? ''}
                    onChange={(event) => setTelegramIds((rows) => ({ ...rows, [employee.id]: event.target.value.replace(/\D/g, '') }))}
                    inputMode="numeric"
                    aria-label={`${employee.fullName} Telegram ID`}
                    placeholder="Telegram ID"
                    className="w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-2 py-2 text-[11px] font-semibold text-stone-800 dark:text-stone-200 outline-none focus:border-brand-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => assignTelegramId(employee)}
                  disabled={busy === `tg-${employee.id}` || !/^\d{4,20}$/.test(telegramIds[employee.id] ?? '')}
                  title="Telegram ID ni saqlash"
                  className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900 dark:bg-stone-100 dark:text-stone-900 text-white disabled:opacity-40"
                >
                  {busy === `tg-${employee.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          {employees.length === 0 && !loading && (
            <p className="py-4 text-center text-xs font-semibold text-stone-500 dark:text-stone-400">Faol xodim topilmadi.</p>
          )}
        </div>
        <p className="mt-3 flex items-start gap-1.5 border-t border-stone-100 dark:border-stone-800 pt-3 text-[10px] leading-relaxed text-stone-500 dark:text-stone-400">
          <KeyRound className="mt-0.5 h-3 w-3 shrink-0" /> Xodim botda /start bosganda ID si chiqadi. ID’ni shu yerga kiriting;
          keyin u qayta /start bossa, roli bo‘yicha avtomatik kiradi.
        </p>
        </section>
      )}

      {section === 'menu' && (
        <>
      {/* Add product */}
      <div className="surface p-4 animate-rise">
        <div className="mb-3 flex items-start gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
            <ImagePlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">Yangi taom qo‘shish</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
              Nomi, narxi va rasmni kiriting
            </p>
          </div>
        </div>

        <form onSubmit={createProduct} className="space-y-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Taom nomi (masalan: Osh)"
            className="field"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="field"
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
              className="field"
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
            className="field"
          />
          <label className="tap flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-800/60 px-3.5 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400 hover:border-brand-300 dark:hover:border-brand-400/40 hover:bg-brand-50/40 dark:hover:bg-brand-400/15">
            <Camera className="h-4 w-4 text-brand-500" />
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
            className="btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Taom qo‘shish
          </button>
        </form>

        <form onSubmit={addCategory} className="mt-3 flex gap-2 border-t border-stone-100 dark:border-stone-800 pt-3">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Yangi kategoriya"
            className="field-mini min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={busy === 'cat'}
            className="tap flex items-center gap-1 rounded-xl bg-stone-900 dark:bg-stone-100 dark:text-stone-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === 'cat' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
            Qo‘shish
          </button>
        </form>
      </div>

      {/* Products */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-kicker">Menyu</h3>
          <span className="text-[10px] font-bold text-stone-500">{products.length} ta taom</span>
        </div>

        {loading && products.length === 0 ? (
          <div className="surface flex items-center justify-center gap-2 py-12 text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            <span className="text-xs font-semibold">Yuklanmoqda...</span>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="surface flex items-center gap-3 p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800">
                {product.thumbnailUrl || product.imageUrl ? (
                  <img
                    src={product.thumbnailUrl || product.imageUrl || ''}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-stone-100">
                    <Utensils className="h-5 w-5 text-brand-300" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-black text-stone-900 dark:text-stone-100">{product.name}</p>
                  <span
                    className={`chip shrink-0 ${
                      product.status === 'ACTIVE'
                        ? 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {product.status === 'ACTIVE' ? 'Faol' : 'O‘chiq'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  {money(product.price)} · {qty(1, product.unit)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <label className="tap inline-flex cursor-pointer items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-400/10 px-2 py-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100">
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
                      className="tap rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1 text-[10px] font-bold text-stone-500 dark:text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleStatus(product)}
                    disabled={busy === `st-${product.id}`}
                    className="tap rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1 text-[10px] font-bold text-stone-600 dark:text-stone-300 disabled:opacity-50"
                  >
                    {product.status === 'ACTIVE' ? 'O‘chirish' : 'Yoqish'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}

      {section === 'overview' && stats && stats.popularProducts.length > 0 && (
        <div className="surface p-4 animate-rise">
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <h3 className="section-kicker">Eng ko‘p sotilganlar</h3>
            <span className="chip bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-200">TOP 5</span>
          </div>
          <div className="space-y-1.5">
            {stats.popularProducts.slice(0, 5).map((p, index) => (
              <div
                key={p.productName}
                className="flex items-center gap-2.5 rounded-xl bg-stone-50/80 dark:bg-stone-800/60 px-2.5 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-stone-900 text-[10px] font-black text-brand-600 dark:text-brand-300 shadow-sm">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {p.productName}
                </span>
                <span className="shrink-0 text-xs font-black text-stone-900 dark:text-stone-100">
                  {money(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {section === 'overview' && (
        <div className="rounded-[26px] border border-rose-200/80 dark:border-rose-400/25 bg-white dark:bg-stone-900 p-4 shadow-sm animate-rise">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-400/10 text-rose-600">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-black text-stone-900 dark:text-stone-100">Sinov ma’lumotlarini tozalash</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
                Buyurtmalar, to‘lovlar, yetkazishlar va xona sessiyalari o‘chiriladi. Menyu,
                xodimlar, xonalar va mijozlar saqlanadi.
              </p>
            </div>
          </div>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => {
                tg.selection();
                setConfirmClear(true);
              }}
              className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-400/25 bg-rose-50 dark:bg-rose-400/10 py-3 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" /> Savdo tarixini tozalash
            </button>
          ) : (
            <div className="mt-3 rounded-2xl border border-rose-200 dark:border-rose-400/25 bg-rose-50 dark:bg-rose-400/10 p-3">
              <p className="text-[11px] font-bold leading-relaxed text-rose-800 dark:text-rose-300">
                Rostdan ham barcha savdo tarixini o‘chirasizmi? Bu amalni ortga qaytarib
                bo‘lmaydi.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  disabled={busy === 'clear-sales'}
                  className="btn-secondary flex-1 py-2.5 text-xs disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={clearSalesHistory}
                  disabled={busy === 'clear-sales'}
                  className="tap flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/25 disabled:opacity-50"
                >
                  {busy === 'clear-sales' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Ha, o‘chirish
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
