"use client";

import { useEffect, useState } from "react";
import { AccountsTable } from "@/components/accounts/accounts-table";
import { AddAccountForm } from "@/components/accounts/add-account-form";
import { AppShell } from "@/components/layout/app-shell";
import { formatDateTimeWithRelative } from "@/lib/format";
import { readManualCache, writeManualCache } from "@/lib/manual-cache";
import { AccountItem } from "@/types/dashboard";

const ACCOUNTS_CACHE_KEY = "oci-panel:accounts:summary";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  function updateAccounts(updater: (current: AccountItem[]) => AccountItem[]) {
    setAccounts((current) => {
      const next = updater(current);
      const cache = writeManualCache(ACCOUNTS_CACHE_KEY, next);
      setLastRefreshedAt(cache?.refreshedAt || new Date().toISOString());
      return next;
    });
  }

  async function loadAccounts(mode: "initial" | "refresh" = "refresh") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      const res = await fetch("/api/accounts/summary", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "加载账户列表失败");
      setAccounts(json as AccountItem[]);
      const cache = writeManualCache(ACCOUNTS_CACHE_KEY, json as AccountItem[]);
      setLastRefreshedAt(cache?.refreshedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cached = readManualCache<AccountItem[]>(ACCOUNTS_CACHE_KEY);
    if (cached) {
      setAccounts(cached.data);
      setLastRefreshedAt(cached.refreshedAt);
      setLoading(false);
      return;
    }
    void loadAccounts("initial");
  }, []);

  return (
    <AppShell>
      {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm text-rose-700">{error}</section> : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">手动刷新控制</p>
                <p className="mt-2 text-sm text-slate-600">账户页优先显示上次成功加载的数据；只有点击刷新才重新查询最新账户摘要。</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500">上次刷新：{lastRefreshedAt ? formatDateTimeWithRelative(lastRefreshedAt) : "尚未刷新"}</span>
                <button
                  type="button"
                  onClick={() => void loadAccounts("refresh")}
                  disabled={refreshing}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {refreshing ? "刷新中..." : "刷新账户摘要"}
                </button>
              </div>
            </div>
          </section>

          <AccountsTable accounts={accounts} loading={loading} onAccountsChange={updateAccounts} />
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><AddAccountForm onSaved={({ id, account }) => updateAccounts((current) => {
            const nextAccount: AccountItem = {
              id,
              name: account.name,
              tenancy: account.tenancy,
              region: account.region,
              status: "healthy",
              instanceCount: 0,
              runningCount: 0,
              stoppedCount: 0,
              lastSync: new Date().toISOString(),
              isDefault: Boolean(account.isDefault) || current.length === 0,
            };
            const normalized = current.map((item) => nextAccount.isDefault ? { ...item, isDefault: false } : item);
            return [nextAccount, ...normalized];
          })} /></div>
        </div>
      )}
    </AppShell>
  );
}
