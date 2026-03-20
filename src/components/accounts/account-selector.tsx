"use client";

import { formatDateTimeWithRelative } from "@/lib/format";

interface AccountOption {
  id: string;
  name: string;
  region: string;
}

export function AccountSelector({
  accounts,
  value,
  onChange,
  hint,
  lastRefreshedAt,
  onRefresh,
  refreshing,
  refreshLabel,
}: {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  lastRefreshedAt?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">账户选择</p>
      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm sm:max-w-md" value={value} onChange={(e) => onChange(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name} · {account.region}</option>
              ))}
            </select>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing || !value}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {refreshing ? "刷新中..." : refreshLabel || "刷新"}
              </button>
            ) : null}
          </div>
          <span className="text-xs text-slate-500 lg:text-right">
            上次刷新：{lastRefreshedAt ? formatDateTimeWithRelative(lastRefreshedAt) : "尚未刷新"}
          </span>
        </div>
        <p className="text-sm text-slate-500">{hint || "账户数据来自账户管理中已添加的 OCI 账户。"}</p>
      </div>
    </section>
  );
}
