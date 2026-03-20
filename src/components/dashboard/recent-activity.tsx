import Link from "next/link";
import { formatDateTimeWithRelative } from "@/lib/format";
import { LogItem } from "@/types/dashboard";

export function RecentActivity({ logs }: { logs: LogItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">最近操作</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">最新活动</h3>
        </div>
        <Link href="/logs" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          查看全部日志
        </Link>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            当前账户还没有最近操作记录。
          </div>
        ) : (
          logs.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.action} · {item.instance}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.account} · {formatDateTimeWithRelative(item.time)} · {item.user}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.result === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {item.result === "success" ? "成功" : "失败"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{item.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
