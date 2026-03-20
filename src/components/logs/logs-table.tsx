"use client";

import { useMemo, useState } from "react";
import { formatDateTimeWithRelative } from "@/lib/format";
import { LogItem } from "@/types/dashboard";

export function LogsTable({ logs, loading }: { logs: LogItem[]; loading?: boolean }) {
  const [accountFilter, setAccountFilter] = useState("全部账户");
  const [resultFilter, setResultFilter] = useState("全部结果");
  const [actionFilter, setActionFilter] = useState("全部操作");
  const [keyword, setKeyword] = useState("");

  const accounts = useMemo(() => Array.from(new Set(logs.map((log) => log.account).filter(Boolean))), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action).filter(Boolean))), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchAccount = accountFilter === "全部账户" || log.account === accountFilter;
      const matchResult = resultFilter === "全部结果" || (resultFilter === "成功" ? log.result === "success" : log.result === "failed");
      const matchAction = actionFilter === "全部操作" || log.action === actionFilter;
      const keywordValue = keyword.trim().toLowerCase();
      const matchKeyword = !keywordValue || [log.account, log.instance, log.action, log.message, log.user, log.time].join(" ").toLowerCase().includes(keywordValue);
      return matchAccount && matchResult && matchAction && matchKeyword;
    });
  }, [logs, accountFilter, resultFilter, actionFilter, keyword]);

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-500">正在加载日志数据...</section>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">操作日志</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">审计与执行记录</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="搜索账户 / 实例 / 操作 / 详情" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option>全部账户</option>
            {accounts.map((account) => <option key={account}>{account}</option>)}
          </select>
          <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option>全部操作</option>
            {actions.map((action) => <option key={action}>{action}</option>)}
          </select>
          <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
            <option>全部结果</option>
            <option>成功</option>
            <option>失败</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">用户</th>
              <th className="px-4 py-3 font-medium">账户</th>
              <th className="px-4 py-3 font-medium">实例</th>
              <th className="px-4 py-3 font-medium">操作</th>
              <th className="px-4 py-3 font-medium">结果</th>
              <th className="px-4 py-3 font-medium">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-4 text-slate-600">{formatDateTimeWithRelative(log.time)}</td>
                <td className="px-4 py-4 text-slate-600">{log.user.slice(0, 8)}...</td>
                <td className="px-4 py-4 text-slate-600">{log.account}</td>
                <td className="px-4 py-4 text-slate-600">{log.instance}</td>
                <td className="px-4 py-4 font-medium text-slate-800">{log.action}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${log.result === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{log.result === "success" ? "成功" : "失败"}</span></td>
                <td className="px-4 py-4 text-slate-600">{log.message}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">当前筛选条件下没有日志</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
