import { useEffect, useState } from "react";
import { dealsApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { formatTHBCompact } from "../utils/currency";

function fmt(n: number) {
  return formatTHBCompact(n);
}

export default function DealsDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = ["admin", "manager", "sales_admin"].includes(user?.role || "");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = isManager ? await dealsApi.dashboardManager() : await dealsApi.dashboardMy();
      setData(r.data);
    } catch {
      setError("Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isManager]);

  const pipeline = Number(data?.pipeline_amount || 0);
  const totalDeals = data?.total_deals || 0;
  const wonDeals = data?.won_deals || 0;
  const openDeals = data?.open_deals || 0;
  const funnel: { stage: string; count: number; amount: number }[] = data?.funnel || [];
  const maxFunnelCount = Math.max(...funnel.map((f) => f.count), 1);
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

  const kpiCards = [
    {
      label: "Total Pipeline",
      value: fmt(pipeline),
      icon: "account_balance_wallet",
      badge: { text: `${openDeals} open`, color: "emerald" },
      barColor: "bg-primary-container",
      barWidth: "75%",
      iconBg: "bg-primary-fixed",
    },
    {
      label: "Won Deals",
      value: wonDeals.toString(),
      icon: "emoji_events",
      badge: { text: "Closed Won", color: "emerald" },
      barColor: "bg-on-tertiary-container",
      barWidth: `${Math.min(winRate, 100)}%`,
      iconBg: "bg-secondary-fixed",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      icon: "trending_up",
      badge: { text: totalDeals > 0 ? "active" : "—", color: "slate" },
      barColor: "bg-tertiary-fixed-dim",
      barWidth: `${Math.min(winRate, 100)}%`,
      iconBg: "bg-tertiary-fixed",
    },
    {
      label: "Active Deals",
      value: openDeals.toString(),
      icon: "handshake",
      badge: { text: "Stable", color: "slate" },
      barColor: "bg-slate-400",
      barWidth: "100%",
      iconBg: "bg-surface-container-highest",
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">
            Executive Dashboard
          </h2>
          <p className="text-on-surface-variant mt-1">
            {isManager ? "Team-wide pipeline overview" : "Your personal pipeline overview"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-lg text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 ${card.iconBg} rounded-lg`}>
                <span className="material-symbols-outlined text-on-primary-fixed">{card.icon}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                card.badge.color === "emerald"
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-slate-500 bg-surface-container-low"
              }`}>
                {card.badge.text}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant font-medium">{card.label}</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-headline">
              {loading ? "—" : card.value}
            </h3>
            <div className="mt-4 h-1 w-full bg-surface-container-low rounded-full overflow-hidden">
              <div className={`h-full ${card.barColor} transition-all duration-500`} style={{ width: loading ? "0%" : card.barWidth }} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tasks Summary */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
          <div className="p-6 border-b border-surface-container-low">
            <h3 className="text-lg font-bold text-slate-900 font-headline">Task Overview</h3>
          </div>
          <div className="p-6 grid grid-cols-3 gap-4">
            {[
              { label: "Overdue", value: data?.overdue_tasks || 0, color: "text-error", bg: "bg-error-container/30" },
              { label: "Today", value: data?.today_tasks || 0, color: "text-on-tertiary-container", bg: "bg-tertiary-fixed/30" },
              { label: "Upcoming", value: data?.upcoming_tasks || 0, color: "text-slate-700", bg: "bg-surface-container-low" },
            ].map((t) => (
              <div key={t.label} className={`${t.bg} rounded-xl p-5 flex flex-col gap-2`}>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t.label}</span>
                <span className={`text-3xl font-extrabold font-headline ${t.color}`}>
                  {loading ? "—" : t.value}
                </span>
              </div>
            ))}
          </div>

          {/* Deal Funnel Bars */}
          {funnel.length > 0 && (
            <div className="px-6 pb-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Deal Stage Breakdown</h4>
              <div className="space-y-3">
                {funnel.map((row) => {
                  const pct = maxFunnelCount > 0 ? Math.round((row.count / maxFunnelCount) * 100) : 0;
                  return (
                    <div key={row.stage}>
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                        <span className="font-medium capitalize">{row.stage.replace("_", " ")}</span>
                        <span className="font-bold">{row.count} deals · {fmt(row.amount)}</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-container rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pipeline Funnel (Dark Card) */}
        <div className="bg-primary-container text-white rounded-xl p-8 flex flex-col">
          <h3 className="text-lg font-bold font-headline mb-6">Pipeline Funnel</h3>
          {funnel.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-on-primary-container text-sm">No funnel data</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {funnel.map((row, idx) => {
                const pct = maxFunnelCount > 0 ? Math.max(15, Math.round((row.count / maxFunnelCount) * 100)) : 15;
                return (
                  <div key={row.stage} style={{ paddingLeft: `${idx * 8}px` }}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                      <span className="capitalize">{row.stage.replace("_", " ")}</span>
                      <span className="font-bold">{fmt(row.amount)}</span>
                    </div>
                    <div className="h-8 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/50">
                      <div
                        className="h-full bg-slate-500/30 rounded-lg transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Summary Table (manager only) */}
        {isManager && (
          <div className="lg:col-span-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 font-headline">Team Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low/50">
                  <tr>
                    {["Sales Rep", "Total", "Open", "Won", "Lost", "Pipeline"].map((h) => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant text-sm">Loading...</td></tr>
                  ) : (data?.owner_summary || []).length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant text-sm">No team data</td></tr>
                  ) : (
                    (data?.owner_summary || []).map((row: any) => (
                      <tr key={row.owner_id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-slate-600 text-xs">
                              {row.owner_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?"}
                            </div>
                            <span className="font-semibold text-slate-900">{row.owner_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{row.total_deals}</td>
                        <td className="px-6 py-4 text-slate-700">{row.open_deals}</td>
                        <td className="px-6 py-4">
                          <span className="text-emerald-600 font-semibold">{row.won_deals}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-error font-semibold">{row.lost_deals}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{fmt(Number(row.pipeline_amount || 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
