"use client";

import Link from "next/link";
import { InstanceDetailItem, InstancePollingMeta, InstanceStatus } from "@/types/dashboard";

const statusStyles: Record<InstanceStatus, string> = {
  running: "bg-emerald-100 text-emerald-700",
  stopped: "bg-slate-200 text-slate-700",
  starting: "bg-blue-100 text-blue-700",
  stopping: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
};

const statusLabels: Record<InstanceStatus, string> = {
  running: "运行中",
  stopped: "已停止",
  starting: "启动中",
  stopping: "停止中",
  error: "异常",
};

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function DetailRow({ label, value, mono = false }: { label: string; value?: string | number; mono?: boolean }) {
  return (
    <div className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className={`text-sm text-slate-800 ${mono ? "break-all font-mono text-xs" : ""}`}>{value || "-"}</span>
    </div>
  );
}

function CopyButton({ value }: { value?: string | number }) {
  const text = value == null ? "" : String(value);
  return (
    <button
      type="button"
      disabled={!text || text === "-"}
      onClick={() => void navigator.clipboard.writeText(text)}
      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40"
    >
      复制
    </button>
  );
}

function ResourceIdCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</span>
        <CopyButton value={value} />
      </div>
      <div className="break-all font-mono text-xs text-slate-800">{value || "-"}</div>
    </div>
  );
}

function SummaryBadge({ label, tone = "slate" }: { label: string; tone?: "slate" | "emerald" | "amber" | "blue" | "rose" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[tone]}`}>{label}</span>;
}

export function InstanceDetailContent({
  detail,
  loading,
  error,
  acting,
  onRefresh,
  onAction,
  showPageLink,
  polling,
}: {
  detail: InstanceDetailItem | null;
  loading: boolean;
  error: string | null;
  acting: boolean;
  onRefresh?: () => void;
  onAction?: (action: "开机" | "关机" | "重启") => void;
  showPageLink?: boolean;
  polling?: InstancePollingMeta;
}) {
  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">正在加载实例详情...</section>;
  }

  if (error) {
    return <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700">{error}</section>;
  }

  if (!detail) {
    return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">请选择一个实例查看详情</section>;
  }

  const isDualStack = Boolean(detail.ipv6 && detail.ipv6 !== "-");
  const hasPublicIp = Boolean((detail.publicIp || detail.ip) && (detail.publicIp || detail.ip) !== "-");
  const isFlex = /flex/i.test(detail.shape || "");
  const subnetBlocksPublicIp = Boolean(detail.subnetProhibitPublicIpOnVnic);

  const riskHints = [
    !hasPublicIp ? "当前实例未发现公网 IPv4，外部直连可能不可用。" : null,
    !isDualStack ? "当前实例未发现 IPv6，双栈能力未启用或未分配。" : null,
    subnetBlocksPublicIp ? "实例所在 Subnet 默认禁止公网 IP，后续公网访问调整需注意网络策略。" : null,
    detail.status === "error" ? "当前实例状态异常，建议先刷新详情并检查生命周期状态。" : null,
  ].filter(Boolean) as string[];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">实例详情</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{detail.name}</h1>
            <p className="mt-2 text-sm text-slate-500">{detail.accountName} · {detail.region}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {onRefresh ? (
              <button onClick={onRefresh} disabled={loading || acting} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                刷新详情
              </button>
            ) : null}
            {showPageLink ? (
              <Link href={`/instances/${encodeURIComponent(detail.id)}?accountId=${encodeURIComponent(detail.accountId || "")}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                独立详情页
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[detail.status]}`}>{statusLabels[detail.status]}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{detail.shape}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{detail.availabilityDomain}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{detail.faultDomain}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <SummaryBadge label={hasPublicIp ? "公网可达" : "无公网 IPv4"} tone={hasPublicIp ? "emerald" : "amber"} />
          <SummaryBadge label={isDualStack ? "双栈已启用" : "仅 IPv4 / 无 IPv6"} tone={isDualStack ? "blue" : "slate"} />
          <SummaryBadge label={isFlex ? "Flex 规格" : "固定规格"} tone={isFlex ? "blue" : "slate"} />
          <SummaryBadge label={subnetBlocksPublicIp ? "子网默认禁公网" : "子网允许公网"} tone={subnetBlocksPublicIp ? "rose" : "emerald"} />
        </div>

        {polling ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${polling.isPolling ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{polling.pollingMessage || (polling.isPolling ? "正在自动跟踪实例状态..." : "当前状态稳定")}</span>
              <span className="text-xs">最近刷新：{formatTime(polling.lastUpdatedAt)}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">实例 ID</span><CopyButton value={detail.id} /></div><div className="break-all font-mono text-xs text-slate-800">{detail.id}</div></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">公网 IPv4</span><CopyButton value={detail.publicIp || detail.ip} /></div><div className="break-all font-mono text-xs text-slate-800">{detail.publicIp || detail.ip || "-"}</div></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">私网 IPv4</span><CopyButton value={detail.privateIp} /></div><div className="break-all font-mono text-xs text-slate-800">{detail.privateIp || "-"}</div></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">IPv6</span><CopyButton value={detail.ipv6} /></div><div className="break-all font-mono text-xs text-slate-800">{detail.ipv6 || "-"}</div></div>
        </div>
      </div>

      {riskHints.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-amber-900">风险提示</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-800">
            {riskHints.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ) : null}

      {onAction ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button disabled={acting} onClick={() => onAction("开机")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">开机</button>
          <button disabled={acting} onClick={() => onAction("关机")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">关机</button>
          <button disabled={acting} onClick={() => onAction("重启")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">重启</button>
          <span className="self-center text-xs text-slate-500">支持在详情页直接操作实例。</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">资产关系区</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ResourceIdCard label="Image ID" value={detail.imageId} />
          <ResourceIdCard label="VCN ID" value={detail.vcnId} />
          <ResourceIdCard label="Subnet ID" value={detail.subnetId} />
          <ResourceIdCard label="VNIC ID" value={detail.vnicId} />
          <ResourceIdCard label="Boot Volume ID" value={detail.bootVolumeId} />
          <ResourceIdCard label="Compartment ID" value={detail.compartmentId} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">实例概览</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="原始状态" value={detail.lifecycleStateRaw} />
          <DetailRow label="创建时间" value={formatTime(detail.timeCreated)} />
          <DetailRow label="Shape" value={detail.shape} />
          <DetailRow label="处理器说明" value={detail.shapeProcessorDescription || "-"} />
          <DetailRow label="当前 OCPU" value={detail.ocpus ?? "-"} />
          <DetailRow label="当前内存 GB" value={detail.memoryInGBs ?? "-"} />
          <DetailRow label="Shape OCPU 范围" value={detail.shapeOcpusOptions || "-"} />
          <DetailRow label="Shape 内存范围" value={detail.shapeMemoryOptions || "-"} />
          <DetailRow label="故障域" value={detail.faultDomain} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">镜像与系统</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="镜像名称" value={detail.imageDisplayName || "-"} />
          <DetailRow label="操作系统" value={detail.imageOperatingSystem || "-"} />
          <DetailRow label="系统版本" value={detail.imageOperatingSystemVersion || "-"} />
          <DetailRow label="Image ID" value={detail.imageId} mono />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">网络明细</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="VNIC ID" value={detail.vnicId} mono />
          <DetailRow label="VCN" value={detail.vcnName || detail.vcnId} />
          <DetailRow label="VCN CIDR" value={detail.vcnCidrBlock || "-"} />
          <DetailRow label="VCN IPv6" value={detail.vcnIpv6CidrBlocks?.length ? detail.vcnIpv6CidrBlocks.join(", ") : "未配置"} />
          <DetailRow label="Subnet" value={detail.subnetName || detail.subnetId} />
          <DetailRow label="Subnet CIDR" value={detail.subnetCidrBlock || "-"} />
          <DetailRow label="Subnet IPv6" value={detail.subnetIpv6CidrBlock || "未配置"} />
          <DetailRow label="公网 IP 策略" value={detail.subnetProhibitPublicIpOnVnic ? "默认禁止公网 IP" : "允许公网 IP"} />
          <DetailRow label="NSG 数量" value={detail.nsgIds?.length || 0} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">NSG IDs</p>
          <div className="mt-2 space-y-2">
            {detail.nsgIds && detail.nsgIds.length > 0 ? detail.nsgIds.map((item) => (
              <div key={item} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <span className="break-all font-mono text-xs text-slate-800">{item}</span>
                <CopyButton value={item} />
              </div>
            )) : <p className="text-sm text-slate-500">当前 VNIC 没有绑定 NSG。</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">启动盘 / Boot Volume</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="Boot Volume 名称" value={detail.bootVolumeName || "-"} />
          <DetailRow label="容量 GB" value={detail.bootVolumeSizeInGBs ?? "-"} />
          <DetailRow label="Boot Volume ID" value={detail.bootVolumeId} mono />
        </div>
      </section>
    </section>
  );
}
