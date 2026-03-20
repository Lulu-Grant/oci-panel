"use client";

import { useEffect, useMemo, useState } from "react";
import { InstanceDetailsDrawer } from "@/components/instances/instance-details-drawer";
import { useToast } from "@/components/ui/toast";
import { InstanceDetailItem, InstanceItem } from "@/types/dashboard";

const statusStyles = {
  running: "bg-emerald-100 text-emerald-700",
  stopped: "bg-slate-200 text-slate-700",
  starting: "bg-blue-100 text-blue-700",
  stopping: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
};

const statusLabels = {
  running: "运行中",
  stopped: "已停止",
  starting: "启动中",
  stopping: "停止中",
  error: "异常",
};

const actionMap = {
  开机: "START",
  关机: "STOP",
  重启: "SOFTRESET",
} as const;

function AssetBadge({ label, tone = "slate" }: { label: string; tone?: "slate" | "emerald" | "blue" | "amber" | "rose" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>{label}</span>;
}

interface ReinstallDraft {
  image: string;
  password: string;
  customImageUrl: string;
}

interface ReinstallCapability {
  success?: boolean;
  supported?: boolean;
  mode?: string;
  reason?: string;
  message?: string;
  managedInstanceId?: string;
  displayName?: string;
  status?: string;
}

const initialReinstallDraft: ReinstallDraft = {
  image: "ubuntu-22.04",
  password: "",
  customImageUrl: "",
};

export function InstancesTable({
  instances,
  loading,
  selectedAccountId,
  initialDetailInstanceId,
  onActionFinished,
}: {
  instances: InstanceItem[];
  loading?: boolean;
  selectedAccountId?: string;
  initialDetailInstanceId?: string;
  onActionFinished?: () => void | Promise<void>;
}) {
  const { pushToast } = useToast();
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("全部状态");
  const [assetFilter, setAssetFilter] = useState<string>("全部资产");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<InstanceDetailItem | null>(null);
  const [activeInstance, setActiveInstance] = useState<InstanceItem | null>(null);
  const [reinstallOpenId, setReinstallOpenId] = useState<string | null>(null);
  const [reinstallDraft, setReinstallDraft] = useState<ReinstallDraft>(initialReinstallDraft);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [reinstallCapability, setReinstallCapability] = useState<ReinstallCapability | null>(null);

  const filteredInstances = useMemo(() => {
    return instances.filter((instance) => {
      const matchSearch = !search.trim() || [instance.name, instance.accountName, instance.region, instance.ip, instance.ipv6, instance.shape, ...(instance.riskFlags || [])]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchStatus = statusFilter === "全部状态" || statusLabels[instance.status] === statusFilter;
      const matchAsset = (() => {
        switch (assetFilter) {
          case "公网机":
            return instance.hasPublicIp;
          case "双栈机":
            return instance.isDualStack;
          case "Flex":
            return instance.isFlexShape;
          case "有风险":
            return Boolean(instance.riskFlags && instance.riskFlags.length > 0);
          default:
            return true;
        }
      })();
      return matchSearch && matchStatus && matchAsset;
    });
  }, [instances, search, statusFilter, assetFilter]);

  async function fetchDetail(instance: InstanceItem) {
    const res = await fetch(`/api/instances/${encodeURIComponent(instance.id)}?accountId=${encodeURIComponent(instance.accountId || "")}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean; message?: string; detail?: InstanceDetailItem };
    if (!res.ok || !data.success || !data.detail) {
      throw new Error(data.message || "加载实例详情失败");
    }
    return data.detail;
  }

  async function openDetails(instance: InstanceItem) {
    if (!instance.accountId || instance.id.startsWith("error-")) {
      pushToast({ tone: "error", message: "该行不是可查看详情的真实实例" });
      return;
    }

    setActiveInstance(instance);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    try {
      const nextDetail = await fetchDetail(instance);
      setDetail(nextDetail);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("accountId", instance.accountId);
        url.searchParams.set("instanceId", instance.id);
        window.history.replaceState({}, "", url.toString());
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "加载实例详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshCurrentDetail() {
    if (!activeInstance) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const nextDetail = await fetchDetail(activeInstance);
      setDetail(nextDetail);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "加载实例详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(instance: InstanceItem, label: keyof typeof actionMap) {
    if (!instance.accountId || instance.id.startsWith("error-")) {
      pushToast({ tone: "error", message: "该行不是可操作实例" });
      return;
    }

    try {
      setActingId(instance.id);
      const res = await fetch("/api/instances/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: instance.accountId, instanceId: instance.id, action: actionMap[label] }),
      });

      const data = await res.json();
      pushToast({ tone: data.success ? "success" : "error", message: data.success ? `${label} 已提交：${data.status || "OK"}` : `操作失败：${data.message}` });

      if (data.success) {
        if (onActionFinished) await onActionFinished();
        if (activeInstance?.id === instance.id) await refreshCurrentDetail();
      }
    } finally {
      setActingId(null);
    }
  }

  async function detectReinstallCapability(instance: InstanceItem) {
    if (!instance.accountId) return;
    try {
      setCapabilityLoading(true);
      setReinstallCapability(null);
      const res = await fetch(`/api/instances/reinstall-capability?accountId=${encodeURIComponent(instance.accountId)}&instanceId=${encodeURIComponent(instance.id)}`, { cache: "no-store" });
      const data = (await res.json()) as ReinstallCapability;
      setReinstallCapability(data);
    } finally {
      setCapabilityLoading(false);
    }
  }

  useEffect(() => {
    if (!initialDetailInstanceId || loading || detailOpen) return;
    const target = instances.find((item) => item.id === initialDetailInstanceId);
    if (target) void openDetails(target);
  }, [initialDetailInstanceId, instances, loading, detailOpen]);

  function closeDetails() {
    setDetailOpen(false);
    setActiveInstance(null);
    setDetail(null);
    setDetailError(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("instanceId");
      window.history.replaceState({}, "", url.toString());
    }
  }

  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-500">正在加载实例数据...</section>;
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">实例管理</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">快速执行实例操作</h3>
            {selectedAccountId ? <p className="mt-2 text-sm text-slate-500">列表页现在支持按资产特征筛选：公网、双栈、Flex、风险实例。</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none ring-0 placeholder:text-slate-400" placeholder="搜索实例 / IP / Shape / 风险" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>全部状态</option><option>运行中</option><option>已停止</option><option>启动中</option><option>停止中</option><option>异常</option></select>
            <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}><option>全部资产</option><option>公网机</option><option>双栈机</option><option>Flex</option><option>有风险</option></select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">实例名</th>
                <th className="px-4 py-3 font-medium">账户</th>
                <th className="px-4 py-3 font-medium">区域</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">资产标记</th>
                <th className="px-4 py-3 font-medium">IPv4</th>
                <th className="px-4 py-3 font-medium">IPv6</th>
                <th className="px-4 py-3 font-medium">规格</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredInstances.map((instance) => (
                <tr key={instance.id} className={`hover:bg-slate-50/70 ${initialDetailInstanceId === instance.id ? "bg-blue-50/60" : ""}`}>
                  <td className="px-4 py-4 font-semibold text-slate-900">{instance.name}</td>
                  <td className="px-4 py-4 text-slate-600">{instance.accountName}</td>
                  <td className="px-4 py-4 text-slate-600">{instance.region}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[instance.status]}`}>{statusLabels[instance.status]}</span></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{instance.hasPublicIp ? <AssetBadge label="公网" tone="emerald" /> : <AssetBadge label="无公网" tone="amber" />}{instance.isDualStack ? <AssetBadge label="双栈" tone="blue" /> : null}{instance.isFlexShape ? <AssetBadge label="Flex" tone="slate" /> : null}{instance.riskFlags?.length ? <AssetBadge label={`风险 ${instance.riskFlags.length}`} tone="rose" /> : null}</div></td>
                  <td className="px-4 py-4 text-slate-600">{instance.ip}</td>
                  <td className="px-4 py-4 text-slate-600">{instance.ipv6}</td>
                  <td className="px-4 py-4 text-slate-600">{instance.shape}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void openDetails(instance)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">详情</button>
                      <button disabled={actingId === instance.id} onClick={() => handleAction(instance, "开机")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">开机</button>
                      <button disabled={actingId === instance.id} onClick={() => handleAction(instance, "关机")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">关机</button>
                      <button disabled={actingId === instance.id} onClick={() => handleAction(instance, "重启")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">重启</button>
                      {instance.accountId ? <button onClick={() => { setReinstallOpenId(instance.id); setReinstallDraft(initialReinstallDraft); void detectReinstallCapability(instance); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50">更多 / DD</button> : null}
                    </div>
                    {instance.riskFlags?.length ? <div className="mt-2 flex flex-wrap gap-1">{instance.riskFlags.slice(0, 3).map((flag) => <AssetBadge key={flag} label={flag} tone="rose" />)}</div> : null}
                  </td>
                </tr>
              ))}
              {filteredInstances.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">当前筛选条件下没有实例</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <InstanceDetailsDrawer open={detailOpen} loading={detailLoading} error={detailError} detail={detail} acting={Boolean(activeInstance && actingId === activeInstance.id)} onClose={closeDetails} onRefresh={() => void refreshCurrentDetail()} onAction={(action) => activeInstance && void handleAction(activeInstance, action)} />

      {reinstallOpenId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">高级操作 / DD 重装</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">OCI 原生执行能力检测</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">这一版不再要求你手动填写 SSH 连接信息，而是优先检测该实例是否已纳入 OCI 原生管理能力（OS Management Hub / Managed Instance）。</p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {capabilityLoading ? <p className="text-sm text-slate-600">正在检测 OCI 原生命令执行能力...</p> : reinstallCapability ? (
                reinstallCapability.success ? reinstallCapability.supported ? (
                  <div className="space-y-2 text-sm text-emerald-800"><p className="font-semibold">已支持 OCI 原生执行</p><p>模式：{reinstallCapability.mode}</p><p>托管实例：{reinstallCapability.displayName || reinstallCapability.managedInstanceId || "-"}</p><p>状态：{reinstallCapability.status || "-"}</p><p>{reinstallCapability.reason}</p></div>
                ) : (
                  <div className="space-y-2 text-sm text-amber-800"><p className="font-semibold">当前未支持 OCI 原生执行</p><p>模式：{reinstallCapability.mode}</p><p>{reinstallCapability.reason || reinstallCapability.message || "未识别原因"}</p></div>
                ) : (
                  <div className="space-y-2 text-sm text-rose-800"><p className="font-semibold">检测失败</p><p>{reinstallCapability.message || "未知错误"}</p></div>
                )
              ) : <p className="text-sm text-slate-600">尚未开始检测</p>}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <select className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={reinstallDraft.image} onChange={(e) => setReinstallDraft({ ...reinstallDraft, image: e.target.value })}>
                <option value="ubuntu-22.04">Ubuntu 22.04</option>
                <option value="ubuntu-24.04">Ubuntu 24.04</option>
                <option value="debian-12">Debian 12</option>
                <option value="centos-9">CentOS 9</option>
                <option value="windows">Windows</option>
                <option value="custom">自定义镜像 URL</option>
              </select>
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="新系统初始密码（预留高级参数）" value={reinstallDraft.password} onChange={(e) => setReinstallDraft({ ...reinstallDraft, password: e.target.value })} />
              {reinstallDraft.image === "custom" ? <input className="md:col-span-2 rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="自定义镜像 URL / 自定义参数入口" value={reinstallDraft.customImageUrl} onChange={(e) => setReinstallDraft({ ...reinstallDraft, customImageUrl: e.target.value })} /> : null}
            </div>
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">当前是 OCI 原生能力版起手：先做能力检测与参数表单重构。只有当实例确实纳入托管实例体系后，下一步才适合继续接真正的任务提交。</div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => { setReinstallOpenId(null); setReinstallDraft(initialReinstallDraft); setReinstallCapability(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">关闭</button>
              <button onClick={() => { const instance = instances.find((item) => item.id === reinstallOpenId); if (instance) void detectReinstallCapability(instance); }} disabled={capabilityLoading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{capabilityLoading ? "检测中..." : "重新检测能力"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
