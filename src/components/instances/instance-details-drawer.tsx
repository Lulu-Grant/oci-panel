"use client";

import { InstanceDetailContent } from "@/components/instances/instance-detail-content";
import { InstanceDetailItem } from "@/types/dashboard";

export function InstanceDetailsDrawer({
  open,
  loading,
  error,
  detail,
  acting,
  onClose,
  onRefresh,
  onAction,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: InstanceDetailItem | null;
  acting: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onAction: (action: "开机" | "关机" | "重启") => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 transition ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-2xl transform border-l border-slate-200 bg-slate-100 shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">实例详情抽屉</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{detail?.name || "加载中..."}</h3>
              <p className="mt-1 text-sm text-slate-500">{detail ? `${detail.accountName} · ${detail.region}` : "读取实例详细信息"}</p>
            </div>
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              关闭
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <InstanceDetailContent
              detail={detail}
              loading={loading}
              error={error}
              acting={acting}
              onRefresh={onRefresh}
              onAction={onAction}
              showPageLink
            />
          </div>
        </div>
      </aside>
    </>
  );
}
