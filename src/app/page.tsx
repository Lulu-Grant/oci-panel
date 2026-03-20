"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AccountSelector } from "@/components/accounts/account-selector";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";
import { readManualCache, writeManualCache } from "@/lib/manual-cache";
import { DashboardData } from "@/types/dashboard";

interface AccountOption {
  id: string;
  name: string;
  region: string;
}

const ACCOUNTS_CACHE_KEY = "oci-panel:dashboard:accounts";
const dashboardCacheKey = (accountId: string) => `oci-panel:dashboard:data:${accountId}`;

export default function Home() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  async function refreshAccountsList() {
    const res = await fetch("/api/accounts", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "加载账户列表失败");
    const accountsData = json as AccountOption[];
    setAccounts(accountsData);
    writeManualCache(ACCOUNTS_CACHE_KEY, accountsData);
    return accountsData;
  }

  async function refreshDashboard(accountId: string, mode: "initial" | "refresh" = "refresh") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);

      let nextAccounts = accounts;
      if (accounts.length === 0) {
        nextAccounts = await refreshAccountsList();
        if (!accountId) {
          accountId = nextAccounts[0]?.id || "";
          if (accountId) setSelectedAccountId(accountId);
        }
      }

      if (!accountId) {
        setData(null);
        return;
      }

      const query = `?accountId=${encodeURIComponent(accountId)}`;
      const res = await fetch(`/api/dashboard${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "加载控制台数据失败");
      setData(json as DashboardData);
      const cache = writeManualCache(dashboardCacheKey(accountId), json as DashboardData);
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
      const firstId = initialAccounts[0]?.id || "";
      setSelectedAccountId(firstId);
      const cachedDashboard = firstId ? readManualCache<DashboardData>(dashboardCacheKey(firstId)) : null;
      if (cachedDashboard) {
        setData(cachedDashboard.data);
        setLastRefreshedAt(cachedDashboard.refreshedAt);
        setLoading(false);
        return;
      }
      void refreshDashboard(firstId, "initial");
      return;
    }
    void refreshDashboard("", "initial");
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    const cached = readManualCache<DashboardData>(dashboardCacheKey(selectedAccountId));
    if (cached) {
      setData(cached.data);
      setLastRefreshedAt(cached.refreshedAt);
      setLoading(false);
      setError(null);
      return;
    }
    void refreshDashboard(selectedAccountId, "initial");
  }, [selectedAccountId]);

  const instances = data?.instances ?? [];
  const logs = data?.logs ?? [];
  const selectedAccount = useMemo(() => accounts.find((item) => item.id === selectedAccountId), [accounts, selectedAccountId]);

  const stats = useMemo(() => {
    const running = instances.filter((item) => item.status === "running").length;
    const stopped = instances.filter((item) => item.status === "stopped").length;
    const publicCount = instances.filter((item) => item.hasPublicIp).length;
    const dualStackCount = instances.filter((item) => item.isDualStack).length;
    const flexCount = instances.filter((item) => item.isFlexShape).length;
    const riskCount = instances.filter((item) => (item.riskFlags?.length || 0) > 0).length;
    const failedOps = logs.filter((item) => item.result === "failed").length;

    return { running, stopped, publicCount, dualStackCount, flexCount, riskCount, failedOps };
  }, [instances, logs]);

  return (
    <AppShell>
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-500">
          正在加载控制台数据...
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm text-rose-700">
          {error}
        </section>
      ) : accounts.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-600">
          <p className="text-lg font-semibold text-slate-900">还没有 OCI 账户</p>
          <p className="mt-2 text-sm">先去账户页添加你的第一个 OCI 账户，之后这里就会显示真实实例和最近日志。</p>
        </section>
      ) : (
        <section className="space-y-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">OCI 多账户资产控制台</p>
            <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard 总览</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  首页围绕当前选定 OCI 账户展示实例资产、风险暴露、最近关键操作与核心入口，作为 create / instances / capacity 的统一控制台起点。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">当前账户</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{selectedAccount?.name || "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">{selectedAccount?.region || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">关键风险</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{stats.riskCount} 台实例</p>
                  <p className="mt-1 text-xs text-slate-500">含公网 / 双栈 / 异常状态标记</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">最近失败操作</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{stats.failedOps} 次</p>
                  <p className="mt-1 text-xs text-slate-500">来自当前账户最近日志</p>
                </div>
              </div>
            </div>
          </section>

          <AccountSelector
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            onRefresh={() => selectedAccountId && void refreshDashboard(selectedAccountId, "refresh")}
            refreshing={refreshing}
            refreshLabel="刷新 Dashboard"
            lastRefreshedAt={lastRefreshedAt}
            hint={`Dashboard 按所选 OCI 账户显示资产摘要、风险视图与最近操作。${selectedAccount ? ` 当前账户：${selectedAccount.name}` : ""}`}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="实例总数" value={String(instances.length)} hint="当前账户下的实例总量" accent="blue" />
            <StatCard label="运行中" value={String(stats.running)} hint="当前处于运行状态的实例" accent="emerald" />
            <StatCard label="已停止" value={String(stats.stopped)} hint="可作为容量与成本观察参考" accent="amber" />
            <StatCard label="公网实例" value={String(stats.publicCount)} hint="存在公网 IPv4 可达的实例" accent="rose" />
            <StatCard label="双栈实例" value={String(stats.dualStackCount)} hint="已检测到 IPv6 地址的实例" accent="blue" />
            <StatCard label="Flex 实例" value={String(stats.flexCount)} hint="更适合与创建能力联动管理" accent="emerald" />
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">账户健康与资产摘要</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">当前账户概览</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">资产暴露面</p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    <li className="flex items-center justify-between"><span>公网实例</span><strong>{stats.publicCount}</strong></li>
                    <li className="flex items-center justify-between"><span>双栈实例</span><strong>{stats.dualStackCount}</strong></li>
                    <li className="flex items-center justify-between"><span>风险标记实例</span><strong>{stats.riskCount}</strong></li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">运行健康</p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    <li className="flex items-center justify-between"><span>运行中</span><strong>{stats.running}</strong></li>
                    <li className="flex items-center justify-between"><span>已停止</span><strong>{stats.stopped}</strong></li>
                    <li className="flex items-center justify-between"><span>最近失败操作</span><strong>{stats.failedOps}</strong></li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                当前 Dashboard 聚焦“资产控制台入口”定位：先从风险、暴露面与近期操作切入，再快速进入实例、创建、容量与账户管理工作流。
              </div>
            </section>

            <QuickActions />
          </div>

          <RecentActivity logs={logs} />
        </section>
      )}
    </AppShell>
  );
}
