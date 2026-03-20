"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AccountSelector } from "@/components/accounts/account-selector";
import { readManualCache, writeManualCache } from "@/lib/manual-cache";

interface CapacityResponse {
  success: boolean;
  account?: { id: string; name: string; region: string };
  regions?: Array<{ regionName?: string; regionKey?: string; status?: string }>;
  availabilityDomains?: Array<{ name?: string }>;
  services?: Array<{ name?: string; description?: string }>;
  limitValues?: Array<Record<string, unknown>>;
  message?: string;
}

interface ParsedLimitValue {
  name: string;
  scopeType: string;
  availabilityDomain: string;
  value: string;
}

interface AccountOption {
  id: string;
  name: string;
  region: string;
  isDefault?: boolean;
}

const ACCOUNTS_CACHE_KEY = "oci-panel:capacity:accounts";
const capacityCacheKey = (accountId: string) => `oci-panel:capacity:data:${accountId}`;

function normalizeText(value: unknown) {
  return String(value ?? "").trim() || "-";
}

export default function CapacityPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [data, setData] = useState<CapacityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string>("全部服务");
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

  async function loadCapacity(accountId: string, mode: "initial" | "refresh" = "initial") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      setServiceFilter("全部服务");
      const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
      const res = await fetch(`/api/capacity${query}`, { cache: "no-store" });
      const json = (await res.json()) as CapacityResponse;
      if (!res.ok || !json.success) throw new Error(json.message || "加载额度信息失败");
      setData(json);
      const cache = writeManualCache(capacityCacheKey(accountId), json);
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
      const defaultAccount = initialAccounts.find((item) => item.isDefault);
      const fallback = defaultAccount?.id || initialAccounts[0]?.id || "";
      if (fallback) setSelectedAccountId(fallback);
      else setLoading(false);
      return;
    }

    async function init() {
      try {
        const accountsData = await refreshAccountsList();
        const defaultAccount = accountsData.find((item) => item.isDefault);
        const fallback = defaultAccount?.id || accountsData[0]?.id || "";
        if (fallback) setSelectedAccountId(fallback);
        else setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    const cached = readManualCache<CapacityResponse>(capacityCacheKey(selectedAccountId));
    if (cached) {
      setData(cached.data);
      setLastRefreshedAt(cached.refreshedAt);
      setLoading(false);
      setError(null);
      return;
    }
    void loadCapacity(selectedAccountId, "initial");
  }, [selectedAccountId]);

  const parsedLimitValues = useMemo<ParsedLimitValue[]>(() => {
    return (data?.limitValues || []).map((item) => ({
      name: normalizeText(item.name || item.displayName || item.limitName),
      scopeType: normalizeText(item.scopeType || item.scope || "区域级"),
      availabilityDomain: normalizeText(item.availabilityDomain || item.ad || "区域级"),
      value: normalizeText(item.value || item.limit || item.available),
    }));
  }, [data?.limitValues]);

  const computeServices = useMemo(() => {
    return (data?.services || []).filter((item) => item.name?.toLowerCase().includes("compute"));
  }, [data?.services]);

  const computeFocusedLimits = useMemo(() => {
    return parsedLimitValues.filter((item) => /(core|ocpu|vm|instance|compute|memory|a1|e2|e3|e4|e5|flex)/i.test(item.name));
  }, [parsedLimitValues]);

  const filteredLimits = useMemo(() => {
    if (serviceFilter === "全部服务") return parsedLimitValues;
    if (serviceFilter === "Compute 重点") return computeFocusedLimits;
    return parsedLimitValues.filter((item) => item.name.toLowerCase().includes(serviceFilter.toLowerCase()));
  }, [parsedLimitValues, serviceFilter, computeFocusedLimits]);

  const overview = useMemo(() => ({
    regionCount: data?.regions?.length || 0,
    adCount: data?.availabilityDomains?.length || 0,
    serviceCount: data?.services?.length || 0,
    limitCount: parsedLimitValues.length,
    computeLimitCount: computeFocusedLimits.length,
  }), [data?.regions?.length, data?.availabilityDomains?.length, data?.services?.length, parsedLimitValues.length, computeFocusedLimits.length]);

  return (
    <AppShell>
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-500">正在加载额度与资源信息...</section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm text-rose-700">{error}</section>
      ) : accounts.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-600">
          还没有可用账户，先去账户页添加 OCI 账户后再查看额度与资源。
        </section>
      ) : (
        <section className="space-y-8">
          <AccountSelector
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            onRefresh={() => selectedAccountId && void loadCapacity(selectedAccountId, "refresh")}
            refreshing={refreshing}
            refreshLabel="刷新 Capacity"
            lastRefreshedAt={lastRefreshedAt}
            hint="额度与资源页优先显示本地缓存；只有点击刷新才重新查询最新容量与限额信息。"
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">P2D · Capacity 增强</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">额度与资源总览</h3>
            <p className="mt-2 text-sm text-slate-500">当前账户：{data?.account?.name} · 默认区域：{data?.account?.region}</p>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">订阅区域</p><p className="mt-2 text-3xl font-semibold text-slate-900">{overview.regionCount}</p></section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">可用域</p><p className="mt-2 text-3xl font-semibold text-slate-900">{overview.adCount}</p></section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">服务数</p><p className="mt-2 text-3xl font-semibold text-slate-900">{overview.serviceCount}</p></section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">全部额度项</p><p className="mt-2 text-3xl font-semibold text-slate-900">{overview.limitCount}</p></section>
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.16em] text-blue-500">Compute 重点</p><p className="mt-2 text-3xl font-semibold text-blue-900">{overview.computeLimitCount}</p></section>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">区域</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">已订阅区域</h3>
              <div className="mt-4 space-y-3">
                {(data?.regions || []).map((region) => (
                  <div key={`${region.regionKey}-${region.regionName}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {region.regionName} ({region.regionKey}) · {region.status}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">可用域</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Availability Domains</h3>
              <div className="mt-4 space-y-3">
                {(data?.availabilityDomains || []).map((ad) => (
                  <div key={ad.name} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {ad.name}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">服务能力</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Compute 重点服务</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {computeServices.length > 0 ? computeServices.map((service) => (
                <div key={service.name} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-900">{service.name}</p>
                  <p className="mt-1 text-xs text-blue-700">{service.description || "-"}</p>
                </div>
              )) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">当前未识别到明显的 Compute 服务名称。</div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">额度结构化展示</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Limit Values</h3>
                <p className="mt-2 text-sm text-slate-500">优先把 Compute 相关额度做成可读卡片，便于为创建实例提供容量参考。</p>
              </div>
              <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                <option>全部服务</option>
                <option>Compute 重点</option>
                {(data?.services || []).slice(0, 8).map((service) => service.name ? <option key={service.name}>{service.name}</option> : null)}
              </select>
            </div>

            <div className="mt-6 grid gap-3 xl:grid-cols-2">
              {filteredLimits.length > 0 ? filteredLimits.slice(0, 24).map((item) => (
                <div key={`${item.name}-${item.scopeType}-${item.availabilityDomain}-${item.value}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-white px-2 py-1 border border-slate-200">{item.scopeType}</span>
                    <span className="rounded-full bg-white px-2 py-1 border border-slate-200">{item.availabilityDomain}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">值：{item.value}</p>
                </div>
              )) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">当前筛选下没有可展示的额度条目。</div>
              )}
            </div>
          </section>
        </section>
      )}
    </AppShell>
  );
}
