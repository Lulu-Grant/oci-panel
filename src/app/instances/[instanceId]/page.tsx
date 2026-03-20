"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/components/ui/toast";
import { InstanceDetailContent } from "@/components/instances/instance-detail-content";
import { InstanceDetailItem, InstancePollingMeta } from "@/types/dashboard";

const actionMap = {
  开机: "START",
  关机: "STOP",
  重启: "SOFTRESET",
} as const;

const TRANSITIONAL_STATES = new Set(["PROVISIONING", "STARTING", "STOPPING"]);
const STABLE_STATES = new Set(["RUNNING", "STOPPED"]);
const POLL_INTERVAL_MS = 6000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export default function InstanceDetailPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { pushToast } = useToast();
  const [instanceId, setInstanceId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [trackMode, setTrackMode] = useState(false);
  const [detail, setDetail] = useState<InstanceDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState<InstancePollingMeta>({
    isPolling: false,
    lastUpdatedAt: undefined,
    pollingMessage: undefined,
  });
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    void params.then((value) => setInstanceId(value.instanceId));
    if (typeof window !== "undefined") {
      const query = new URLSearchParams(window.location.search);
      setAccountId(query.get("accountId") || "");
      setTrackMode(query.get("track") === "create");
    }
  }, [params]);

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, []);

  async function loadDetail(targetAccountId: string, targetInstanceId: string, options?: { silent?: boolean }) {
    if (!targetAccountId || !targetInstanceId) return null;
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instances/${encodeURIComponent(targetInstanceId)}?accountId=${encodeURIComponent(targetAccountId)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { success?: boolean; message?: string; detail?: InstanceDetailItem };
      if (!res.ok || !data.success || !data.detail) {
        throw new Error(data.message || "加载实例详情失败");
      }
      setDetail(data.detail);
      setPolling((prev) => ({ ...prev, lastUpdatedAt: new Date().toISOString() }));
      return data.detail;
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载实例详情失败";
      setError(message);
      return null;
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  function stopPolling(message?: string) {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    pollingStartedAtRef.current = null;
    setPolling((prev) => ({
      ...prev,
      isPolling: false,
      pollingMessage: message || prev.pollingMessage,
    }));
  }

  function schedulePolling(targetAccountId: string, targetInstanceId: string) {
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    pollingTimerRef.current = setTimeout(async () => {
      const nextDetail = await loadDetail(targetAccountId, targetInstanceId, { silent: true });
      if (!nextDetail) {
        stopPolling("状态跟踪已停止：刷新详情失败");
        return;
      }
      evaluatePolling(nextDetail, targetAccountId, targetInstanceId);
    }, POLL_INTERVAL_MS);
  }

  function evaluatePolling(currentDetail: InstanceDetailItem, targetAccountId: string, targetInstanceId: string) {
    const rawState = currentDetail.lifecycleStateRaw || "UNKNOWN";

    if (STABLE_STATES.has(rawState)) {
      stopPolling(`状态已稳定：${rawState}`);
      return;
    }

    if (!TRANSITIONAL_STATES.has(rawState)) {
      stopPolling(`状态跟踪结束：当前状态 ${rawState}`);
      return;
    }

    if (!pollingStartedAtRef.current) {
      pollingStartedAtRef.current = Date.now();
    }

    if (Date.now() - pollingStartedAtRef.current > POLL_TIMEOUT_MS) {
      stopPolling("状态跟踪超时，已停止自动轮询");
      return;
    }

    setPolling((prev) => ({
      ...prev,
      isPolling: true,
      pollingMessage: `正在自动跟踪实例状态：${rawState}`,
    }));
    schedulePolling(targetAccountId, targetInstanceId);
  }

  useEffect(() => {
    async function bootstrap() {
      if (accountId && instanceId) {
        const nextDetail = await loadDetail(accountId, instanceId);
        if (nextDetail && trackMode) {
          pollingStartedAtRef.current = Date.now();
          evaluatePolling(nextDetail, accountId, instanceId);
        } else if (nextDetail) {
          setPolling((prev) => ({
            ...prev,
            isPolling: false,
            pollingMessage: STABLE_STATES.has(nextDetail.lifecycleStateRaw) ? `状态已稳定：${nextDetail.lifecycleStateRaw}` : undefined,
          }));
        }
      } else if (instanceId) {
        setLoading(false);
        setError("缺少 accountId，请从实例列表进入详情页，或手动补上 ?accountId=...");
      }
    }

    void bootstrap();
  }, [accountId, instanceId, trackMode]);

  async function handleAction(label: keyof typeof actionMap) {
    if (!accountId || !instanceId) return;
    try {
      setActing(true);
      const res = await fetch("/api/instances/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          instanceId,
          action: actionMap[label],
        }),
      });

      const data = await res.json();
      pushToast({ tone: data.success ? "success" : "error", message: data.success ? `${label} 已提交：${data.status || "OK"}` : `操作失败：${data.message}` });

      if (data.success) {
        const nextDetail = await loadDetail(accountId, instanceId);
        if (nextDetail) {
          pollingStartedAtRef.current = Date.now();
          evaluatePolling(nextDetail, accountId, instanceId);
        }
      }
    } finally {
      setActing(false);
    }
  }

  const backHref = useMemo(() => {
    if (!accountId) return "/instances";
    return `/instances?accountId=${encodeURIComponent(accountId)}&instanceId=${encodeURIComponent(instanceId)}`;
  }, [accountId, instanceId]);

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">实例详情页</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">独立实例详情</h2>
            <p className="mt-2 text-sm text-slate-500">适合完整查看实例网络、资源和直接执行操作。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={backHref} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              返回实例列表
            </Link>
          </div>
        </div>

        <InstanceDetailContent
          detail={detail}
          loading={loading}
          error={error}
          acting={acting}
          polling={polling}
          onRefresh={accountId && instanceId ? () => void loadDetail(accountId, instanceId) : undefined}
          onAction={accountId && instanceId ? (action) => void handleAction(action) : undefined}
        />
      </section>
    </AppShell>
  );
}
