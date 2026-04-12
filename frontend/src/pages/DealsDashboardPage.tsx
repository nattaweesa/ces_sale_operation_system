import { useEffect, useState } from "react";
import { dealsApi, departmentsApi, usersApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { formatTHBCompact } from "../utils/currency";

function fmt(n: number) {
  return formatTHBCompact(n);
}

export default function DealsDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = ["admin", "manager", "sales_admin"].includes(user?.role || "");
  const canFilterDepartment = ["admin", "manager"].includes(user?.role || "");

  const [data, setData] = useState<any>(null);
  const [ownerIdFilter, setOwnerIdFilter] = useState<number | null>(null);
  const [departmentIdFilter, setDepartmentIdFilter] = useState<number | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<Array<{ owner_id: number; owner_name: string }>>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [allowedOwnerIds, setAllowedOwnerIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (canFilterDepartment && departmentOptions.length === 0) {
        try {
          const depRes = await departmentsApi.list();
          const opts = (depRes.data || [])
            .filter((d: any) => !!d.is_active)
            .map((d: any) => ({ id: Number(d.id), name: String(d.name) }))
            .filter((d: { id: number }) => Number.isFinite(d.id));
          setDepartmentOptions(opts);
        } catch {
          setDepartmentOptions([]);
        }
      }

      const r = isManager
        ? await dealsApi.dashboardManager({
          ...(ownerIdFilter ? { owner_id: ownerIdFilter } : {}),
          ...(departmentIdFilter ? { department_id: departmentIdFilter } : {}),
        })
        : await dealsApi.dashboardMy();
      setData(r.data);

      if (isManager && Array.isArray(r.data?.owner_summary)) {
        let ownerIds = allowedOwnerIds;
        if (!ownerIds) {
          try {
            const usersRes = await usersApi.list();
            ownerIds = (usersRes.data || [])
              .filter((u: any) => ["sales", "manager"].includes(String(u.role || "").toLowerCase()))
              .map((u: any) => Number(u.id))
              .filter((id: number) => Number.isFinite(id));
          } catch {
            ownerIds = [];
          }
          setAllowedOwnerIds(ownerIds);
        }

        const options = r.data.owner_summary
          .filter((row: any) => (ownerIds || []).includes(Number(row.owner_id)))
          .map((row: any) => ({ owner_id: Number(row.owner_id), owner_name: String(row.owner_name || `User ${row.owner_id}`) }))
          .filter((row: { owner_id: number }) => Number.isFinite(row.owner_id));

        setOwnerOptions(options);
      }
    } catch {
      setError("Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // reload when role context or owner filter changes
  }, [isManager, ownerIdFilter, departmentIdFilter]);

  const pipeline = Number(data?.pipeline_amount || 0);
  const totalDeals = data?.total_deals || 0;
  const wonDeals = data?.won_deals || 0;
  const openDeals = data?.open_deals || 0;
  const funnel: { stage: string; count: number; amount: number }[] = data?.funnel || [];
  const wonAmount = funnel
    .filter((row) => String(row.stage || "").toLowerCase() === "won")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const maxFunnelCount = Math.max(...funnel.map((f) => f.count), 1);
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

  const kpiCards = [
    {
      label: "Total Pipeline",
      value: fmt(pipeline),
      icon: "account_balance_wallet",
      badge: { text: `${openDeals} active`, color: "emerald" },
      barColor: "bg-[#8e95ff]",
      barWidth: "75%",
      iconBg: "bg-[#1f3159]",
    },
    {
      label: "Won Deals",
      value: wonDeals.toString(),
      subValue: fmt(wonAmount),
      icon: "emoji_events",
      badge: { text: "Closed Won", color: "emerald" },
      barColor: "bg-[#6bffc1]",
      barWidth: `${Math.min(winRate, 100)}%`,
      iconBg: "bg-[#1f3159]",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      icon: "trending_up",
      badge: { text: totalDeals > 0 ? "active" : "-", color: "slate" },
      barColor: "bg-[#76c4ff]",
      barWidth: `${Math.min(winRate, 100)}%`,
      iconBg: "bg-[#1f3159]",
    },
    {
      label: "Active Deals",
      value: openDeals.toString(),
      icon: "handshake",
      badge: { text: "Stable", color: "slate" },
      barColor: "bg-[#7f91b9]",
      barWidth: "100%",
      iconBg: "bg-[#1f3159]",
    },
  ];

  return (
    <div className="deals-dashboard-page text-[#dbe3ff]">
      <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#dbe3ff] font-headline">Executive Dashboard</h2>
          <p className="text-[#97a6c9] mt-1">{isManager ? "Team-wide pipeline overview" : "Your personal pipeline overview"}</p>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          {isManager && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#97a6c9] uppercase tracking-wide">Deal Owner</label>
              <select
                className="dashboard-filter-select px-3 py-2 rounded-lg border border-[#233861] bg-[#0f1d3b] text-[#dbe3ff] text-sm min-w-[220px]"
                value={ownerIdFilter ?? "all"}
                onChange={(e) => setOwnerIdFilter(e.target.value === "all" ? null : Number(e.target.value))}
              >
                <option value="all">All owners</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.owner_id} value={owner.owner_id}>
                    {owner.owner_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canFilterDepartment && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#97a6c9] uppercase tracking-wide">Departments</label>
              <select
                className="dashboard-filter-select px-3 py-2 rounded-lg border border-[#233861] bg-[#0f1d3b] text-[#dbe3ff] text-sm min-w-[220px]"
                value={departmentIdFilter ?? "all"}
                onChange={(e) => setDepartmentIdFilter(e.target.value === "all" ? null : Number(e.target.value))}
              >
                <option value="all">All departments</option>
                {departmentOptions.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="dashboard-refresh-btn flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#8f95ff] to-[#6f76ef] text-[#0f154b] text-sm font-semibold hover:brightness-105 transition disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-[#3a1f2a] text-[#ffb7c4] rounded-lg text-sm flex items-center gap-2 border border-[#5d2a39]">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-[#101d3b] p-6 rounded-xl border border-[#1f3159]">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 ${card.iconBg} rounded-lg`}>
                <span className="material-symbols-outlined text-[#dbe3ff]">{card.icon}</span>
              </div>
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  card.badge.color === "emerald" ? "text-[#6bffc1] bg-[#11372f]" : "text-[#9fb0d2] bg-[#1a2848]"
                }`}
              >
                {card.badge.text}
              </span>
            </div>
            <p className="text-sm text-[#97a6c9] font-medium">{card.label}</p>
            <h3 className="text-2xl font-extrabold text-[#e5ebff] mt-1 font-headline">{loading ? "-" : card.value}</h3>
            {card.subValue && (
              <p className="text-xs font-semibold text-[#9fb0d2] mt-1">{loading ? "-" : card.subValue}</p>
            )}
            <div className="mt-4 h-1 w-full bg-[#233861] rounded-full overflow-hidden">
              <div className={`h-full ${card.barColor} transition-all duration-500`} style={{ width: loading ? "0%" : card.barWidth }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#101d3b] rounded-xl border border-[#1f3159] overflow-hidden">
          <div className="p-6 border-b border-[#1f3159]">
            <h3 className="text-lg font-bold text-[#dbe3ff] font-headline">Task Overview</h3>
          </div>
          <div className="p-6 grid grid-cols-3 gap-4">
            {[
              { label: "Overdue", value: data?.overdue_tasks || 0, color: "text-[#ff8aa0]", bg: "bg-[#3a1f2a]" },
              { label: "Today", value: data?.today_tasks || 0, color: "text-[#8fd3ff]", bg: "bg-[#1a2b45]" },
              { label: "Upcoming", value: data?.upcoming_tasks || 0, color: "text-[#dbe3ff]", bg: "bg-[#1a2848]" },
            ].map((t) => (
              <div key={t.label} className={`${t.bg} rounded-xl p-5 flex flex-col gap-2`}>
                <span className="text-xs font-bold text-[#9fb0d2] uppercase tracking-widest">{t.label}</span>
                <span className={`text-3xl font-extrabold font-headline ${t.color}`}>{loading ? "-" : t.value}</span>
              </div>
            ))}
          </div>

          {funnel.length > 0 && (
            <div className="px-6 pb-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#9fb0d2] mb-4">CES Stage Breakdown</h4>
              <div className="space-y-3">
                {funnel.map((row) => {
                  const pct = maxFunnelCount > 0 ? Math.round((row.count / maxFunnelCount) * 100) : 0;
                  return (
                    <div key={row.stage}>
                      <div className="flex justify-between text-xs text-[#9fb0d2] mb-1">
                        <span className="font-medium capitalize">{row.stage.replace("_", " ")}</span>
                        <span className="font-bold">{row.count} deals · {fmt(row.amount)}</span>
                      </div>
                      <div className="h-2 w-full bg-[#223861] rounded-full overflow-hidden">
                        <div className="h-full bg-[#8e95ff] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#0f1d3b] text-[#dbe3ff] rounded-xl border border-[#1f3159] p-8 flex flex-col">
          <h3 className="text-lg font-bold font-headline mb-6">Pipeline Funnel</h3>
          {funnel.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#9fb0d2] text-sm">No funnel data</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {funnel.map((row, idx) => {
                const pct = maxFunnelCount > 0 ? Math.max(15, Math.round((row.count / maxFunnelCount) * 100)) : 15;
                return (
                  <div key={row.stage} style={{ paddingLeft: `${idx * 8}px` }}>
                    <div className="flex justify-between text-xs text-[#9fb0d2] mb-1.5">
                      <span className="capitalize">{row.stage.replace("_", " ")}</span>
                      <span className="font-bold">{fmt(row.amount)}</span>
                    </div>
                    <div className="h-8 bg-[#09142b] rounded-lg overflow-hidden border border-[#223861]">
                      <div className="h-full bg-[#8d95ff]/35 rounded-lg transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isManager && (
          <div className="lg:col-span-3 bg-[#101d3b] rounded-xl border border-[#1f3159] overflow-hidden">
            <div className="p-6 border-b border-[#1f3159] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#dbe3ff] font-headline">Team Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#0b1731]">
                  <tr>
                    {["Sales Rep", "Total", "Active", "Won", "Lost", "Pipeline"].map((h) => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-[#9fb0d2] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f3159]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#9fb0d2] text-sm">
                        Loading...
                      </td>
                    </tr>
                  ) : (data?.owner_summary || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#9fb0d2] text-sm">
                        No team data
                      </td>
                    </tr>
                  ) : (
                    (data?.owner_summary || []).map((row: any) => (
                      <tr key={row.owner_id} className="hover:bg-[#132348] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1a2b4d] flex items-center justify-center font-bold text-[#dbe3ff] text-xs">
                              {row.owner_name
                                ?.split(" ")
                                .map((w: string) => w[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "?"}
                            </div>
                            <span className="font-semibold text-[#dbe3ff]">{row.owner_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#9fb0d2]">{row.total_deals}</td>
                        <td className="px-6 py-4 text-[#9fb0d2]">{row.open_deals}</td>
                        <td className="px-6 py-4">
                          <span className="text-[#6bffc1] font-semibold">{row.won_deals}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[#ff8aa0] font-semibold">{row.lost_deals}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-[#dbe3ff]">{fmt(Number(row.pipeline_amount || 0))}</td>
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
