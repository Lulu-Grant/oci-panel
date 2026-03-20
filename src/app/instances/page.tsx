"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AccountSelector } from "@/components/accounts/account-selector";
import { InstancesTable } from "@/components/instances/instances-table";
import { readManualCache, writeManualCache } from "@/lib/manual-cache";
import { InstanceItem } from "@/types/dashboard";

interface AccountOption {
  id: string;
  name: string;
  region: string;
  isDefault?: boolean;
}

const ACCOUNTS_CACHE_KEY = "oci-panel:instances:accounts";
const instancesCacheKey = (accountId: string) => `oci-panel:instances:list:${accountId}`;

export default function InstancesPage() {
  const [requestedAccountId, setRequestedAccountId] = useState<string>("");
  const [requestedInstanceId, setRequestedInstanceId] = useState<string>("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [staleHint, setStaleHint] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRequestedAccountId(params.get("accountId") || "");
    setRequestedInstanceId(params.get("instanceId") || "");
  }, []);

  async function refreshAccountsList() {
    const res = await fetch("/api/accounts", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "加载账户列表失败");
    const accountsData = json as AccountOption[];
    setAccounts(accountsData);
    writeManualCache(ACCOUNTS_CACHE_KEY, accountsData);
    return accountsData;
  }

  async function loadInstances(accountId: string, mode: "initial" | "refresh" = "initial") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      setStaleHint(null);
      const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
      const res = await fetch(`/api/instances${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "加载实例列表失败");
      setInstances(json as InstanceItem[]);
      const cache = writeManualCache(instancesCacheKey(accountId), json as InstanceItem[]);
      setLastRefreshedAt(cache?.refreshedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cachedAccounts = readManualCache<AccountOption[]>(ACCOUNTS_CACHE_KEY);
    const initialAccounts = cachedAccounts?.data || [];
    if (initialAccounts.length > 0) {
      setAccounts(initialAccounts);
      const matched = requestedAccountId ? initialAccounts.find((item) => item.id === requestedAccountId) : undefined;
      const defaultAccount = initialAccounts.find((item) => item.isDefault);
      const fallback = matched?.id || defaultAccount?.id || initialAccounts[0]?.id || "";
      if (fallback) {
        setSelectedAccountId(fallback);
      } else {
        setLoading(false);
      }
      return;
    }

    async function loadInitialAccounts() {
      try {
        const accountsData = await refreshAccountsList();
        const matched = requestedAccountId ? accountsData.find((item) => item.id === requestedAccountId) : undefined;
        const defaultAccount = accountsData.find((item) => item.isDefault);
        const fallback = matched?.id || defaultAccount?.id || accountsData[0]?.id || "";
        if (fallback) setSelectedAccountId(fallback);
        else setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
        setLoading(false);
      }
    }

    void loadInitialAccounts();
  }, [requestedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    const cached = readManualCache<InstanceItem[]>(instancesCacheKey(selectedAccountId));
    if (cached) {
      setInstances(cached.data);
      setLastRefreshedAt(cached.refreshedAt);
      setLoading(false);
      setError(null);
      return;
    }
    void loadInstances(selectedAccountId, "initial");
  }, [selectedAccountId]);

  return (
    <AppShell>
      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm text-rose-700">
          {error}
        </section>
      ) : accounts.length === 0 && !loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-600">
          还没有可用账户，先去账户页添加 OCI 账户后再查看实例。
        </section>
      ) : (
        <section className="space-y-6">
          <AccountSelector
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            onRefresh={() => selectedAccountId && void loadInstances(selectedAccountId, "refresh")}
            refreshing={refreshing}
            refreshLabel="刷新实例列表"
            lastRefreshedAt={lastRefreshedAt}
            hint="当前实例管理页优先显示上次成功加载的缓存；只有点击刷新才重新拉取所选 OCI 账户下的实例。"
          />

          {staleHint ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {staleHint}
            </section>
          ) : null}

          <InstancesTable
            instances={instances}
            loading={loading}
            selectedAccountId={selectedAccountId}
            initialDetailInstanceId={requestedInstanceId}
            onActionFinished={() => {
              setStaleHint("实例操作已提交，当前列表仍显示上次缓存结果；如需查看最新状态，请手动点击刷新实例列表。");
            }}
          />
        </section>
      )}
    </AppShell>
  );
}
