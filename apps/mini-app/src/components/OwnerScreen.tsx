import React, { useEffect, useState } from 'react';
import { BarChart3, Flame, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { money } from '../lib/format';

interface Props {
  token: string;
}

export const OwnerScreen: React.FC<Props> = ({ token }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const stats = await api.getDashboard(token);
      setData(stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between bg-stone-900 text-white p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-wide">Egasi ekrani (Dashboard)</h2>
            <p className="text-xs text-stone-400">Bugungi hisobotlar</p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          className="rounded-xl bg-stone-800 p-2 text-stone-300 hover:bg-stone-700 active:rotate-180 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-white border border-stone-200/80 p-4 shadow-sm">
              <span className="text-xs font-semibold text-stone-500">Bugungi tushum</span>
              <p className="text-lg font-black text-emerald-700 mt-1">{money(data.todayRevenue)}</p>
            </div>
            <div className="rounded-3xl bg-white border border-stone-200/80 p-4 shadow-sm">
              <span className="text-xs font-semibold text-stone-500">Kassaga tushgan</span>
              <p className="text-lg font-black text-blue-700 mt-1">{money(data.paidToday)}</p>
            </div>
            <div className="rounded-3xl bg-white border border-stone-200/80 p-4 shadow-sm">
              <span className="text-xs font-semibold text-stone-500">Yopilmagan qarz</span>
              <p className="text-lg font-black text-rose-600 mt-1">{money(data.unpaidOutstanding)}</p>
            </div>
            <div className="rounded-3xl bg-white border border-stone-200/80 p-4 shadow-sm">
              <span className="text-xs font-semibold text-stone-500">Buyurtmalar</span>
              <p className="text-lg font-black text-stone-900 mt-1">{data.todayOrderCount} ta</p>
            </div>
          </div>

          {/* Top Products */}
          {data.popularProducts && data.popularProducts.length > 0 && (
            <div className="rounded-3xl bg-white border border-stone-200/80 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Bugungi top taomlar
                </h3>
              </div>
              <div className="divide-y divide-stone-100">
                {data.popularProducts.slice(0, 5).map((p: any, idx: number) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800">
                      {idx + 1}. {p.productName}
                    </span>
                    <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-lg">
                      {p.quantity} ta
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
