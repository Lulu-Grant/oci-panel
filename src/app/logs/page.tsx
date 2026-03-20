"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { LogsTable } from "@/components/logs/logs-table";
import { formatDateTimeWithRelative } from "@/lib/format";
import { readManualCache, writeManualCache } from "@/lib/manual-cache";
import { LogItem } from "@/types/dashboard";

const LOGS_CACHE_KEY = "oci-panel:logs:list";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  async function load(mode: "initial" | "refresh" = "initial") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      const res = await fetch("/api/logs", { cache: "no-store" });
      const json = (await res.json()) as LogItem[];
      if (!res.ok) throw new Error("加载日志失败");
      setLogs(json);
      const cache = writeManualCache(LOGS_CACHE_KEY, json);
      setLastRefreshedAt(cache?.refreshedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cached = readManualCache<LogItem[]>(LOGS_CACHE_KEY);
    if (cached) {
      setLogs(cached.data);
      setLastRefreshedAt(cached.refreshedAt);
      setLoading(false);
      return;
    }
    void load("initial");
  }, []);

  return (
    <AppShell>
      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm text-rose-700">{error}</section>
      ) : (
        <section className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">手动刷新控制</p>
                <p className="mt-2 text-sm text-slate-600">日志页优先显示上次成功加载的数据；只有点击刷新才重新查询最新审计日志。</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500">上次刷新：{lastRefreshedAt ? formatDateTimeWithRelative(lastRefreshedAt) : "尚未刷新"}</span>
                <button
                  type="button"
                  onClick={() => void load("refresh")}
                  disabled={refreshing}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {refreshing ? "刷新中..." : "刷新日志"}
                </button>
              </div>
            </div>
          </section>

          <LogsTable logs={logs} loading={loading} />
        </section>
      )}
    </AppShell>
  );
}
