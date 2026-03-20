"use client";

import { useMemo, useState } from "react";
import { EditAccountForm } from "@/components/accounts/edit-account-form";
import { formatDateTimeWithRelative } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { AccountItem } from "@/types/dashboard";

const statusStyles = { healthy: "bg-emerald-100 text-emerald-700", warning: "bg-amber-100 text-amber-700", error: "bg-rose-100 text-rose-700" };
const statusLabels = { healthy: "正常", warning: "停用/警告", error: "异常" };

export function AccountsTable({
  accounts,
  loading,
  onAccountsChange,
}: {
  accounts: AccountItem[];
  loading?: boolean;
  onAccountsChange?: (updater: (current: AccountItem[]) => AccountItem[]) => void;
}) {
  const { pushToast } = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部状态");

  const summary = useMemo(() => ({
    total: accounts.length,
    defaults: accounts.filter((a) => a.isDefault).length,
    healthy: accounts.filter((a) => a.status === "healthy").length,
    unhealthy: accounts.filter((a) => a.status !== "healthy").length,
  }), [accounts]);

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const kw = keyword.trim().toLowerCase();
    const matchKeyword = !kw || [account.name, account.tenancy, account.region].join(" ").toLowerCase().includes(kw);
    const matchStatus = statusFilter === "全部状态" || (statusFilter === "正常" ? account.status === "healthy" : statusFilter === "停用/警告" ? account.status === "warning" : account.status === "error");
    return matchKeyword && matchStatus;
  }), [accounts, keyword, statusFilter]);

  async function handleTest(accountId: string) {
    try {
      setTestingId(accountId);
      const res = await fetch("/api/accounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      pushToast({ tone: data.success ? "success" : "error", message: data.success ? `测试成功：${data.tenancyName || data.message}` : `测试失败：${data.message}` });
      if (data.success) {
        onAccountsChange?.((current) => current.map((account) => account.id === accountId ? {
          ...account,
          status: "healthy",
          lastSync: new Date().toISOString(),
        } : account));
      }
    } finally {
      setTestingId(null);
    }
  }

  async function handleSetDefault(accountId: string) {
    try {
      setSettingDefaultId(accountId);
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, action: "setDefault" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "设置默认账户失败");
      pushToast({ tone: "success", message: "默认账户已更新" });
      onAccountsChange?.((current) => current.map((account) => ({ ...account, isDefault: account.id === accountId })));
    } catch (error) {
      pushToast({ tone: "error", message: error instanceof Error ? error.message : "设置默认账户失败" });
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete(accountId: string) {
    try {
      setDeletingId(accountId);
      const res = await fetch(`/api/accounts?accountId=${encodeURIComponent(accountId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "删除账户失败");
      pushToast({ tone: "success", message: "账户已删除" });
      onAccountsChange?.((current) => current.filter((account) => account.id !== accountId).map((account) => ({ ...account, isDefault: data.nextDefaultAccountId ? account.id === data.nextDefaultAccountId : account.isDefault })));
    } catch (error) {
      pushToast({ tone: "error", message: error instanceof Error ? error.message : "删除账户失败" });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  async function handleToggleActive(accountId: string, nextActive: boolean) {
    try {
      setTogglingActiveId(accountId);
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, action: "setActive", isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "更新账户状态失败");
      pushToast({ tone: "success", message: nextActive ? "账户已启用" : "账户已停用" });
      onAccountsChange?.((current) => current.map((account) => account.id === accountId ? {
        ...account,
        status: nextActive ? "healthy" : "warning",
        isDefault: data.isDefault ?? account.isDefault,
      } : data.isDefault && account.isDefault ? { ...account, isDefault: false } : account));
    } catch (error) {
      pushToast({ tone: "error", message: error instanceof Error ? error.message : "更新账户状态失败" });
    } finally {
      setTogglingActiveId(null);
    }
  }

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-500">正在加载账户数据...</section>;

  return (
    <>
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-400">账户总数</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-400">默认账户</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.defaults}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-400">正常账户</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.healthy}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-400">停用/异常</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.unhealthy}</p></div>
        </div>

        <div className="flex items-center justify-between"><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">账户管理</p><h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">统一管理 Oracle API 账户</h3></div></div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="搜索账户名 / tenancy / region" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <select className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>全部状态</option><option>正常</option><option>停用/警告</option><option>异常</option></select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3 font-medium">别名</th><th className="px-4 py-3 font-medium">区域</th><th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">默认</th><th className="px-4 py-3 font-medium">实例数</th><th className="px-4 py-3 font-medium">运行中</th><th className="px-4 py-3 font-medium">已停止</th><th className="px-4 py-3 font-medium">最近同步</th><th className="px-4 py-3 font-medium">操作</th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredAccounts.map((account) => <tr key={account.id}><td className="px-4 py-4"><p className="font-semibold text-slate-900">{account.name}</p></td><td className="px-4 py-4 text-slate-600">{account.region}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[account.status]}`}>{statusLabels[account.status]}</span></td><td className="px-4 py-4 text-slate-600">{account.isDefault ? "是" : "-"}</td><td className="px-4 py-4 text-slate-600">{account.instanceCount}</td><td className="px-4 py-4 text-slate-600">{account.runningCount ?? 0}</td><td className="px-4 py-4 text-slate-600">{account.stoppedCount ?? 0}</td><td className="px-4 py-4 text-slate-600">{formatDateTimeWithRelative(account.lastSync)}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button onClick={() => setEditingAccountId(account.id)} disabled={testingId === account.id || settingDefaultId === account.id || deletingId === account.id || togglingActiveId === account.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">编辑</button><button onClick={() => handleTest(account.id)} disabled={testingId === account.id || settingDefaultId === account.id || deletingId === account.id || togglingActiveId === account.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">{testingId === account.id ? "测试中..." : "测试"}</button><button onClick={() => handleSetDefault(account.id)} disabled={account.isDefault || settingDefaultId === account.id || testingId === account.id || deletingId === account.id || togglingActiveId === account.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">{account.isDefault ? "默认账户" : settingDefaultId === account.id ? "设置中..." : "设为默认"}</button><button onClick={() => handleToggleActive(account.id, account.status !== "healthy")} disabled={togglingActiveId === account.id || deletingId === account.id || settingDefaultId === account.id || testingId === account.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">{togglingActiveId === account.id ? "处理中..." : account.status === "healthy" ? "停用" : "启用"}</button><button onClick={() => setPendingDelete({ id: account.id, name: account.name })} disabled={deletingId === account.id || settingDefaultId === account.id || testingId === account.id || togglingActiveId === account.id} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">{deletingId === account.id ? "删除中..." : "删除"}</button></div></td></tr>)}
              {filteredAccounts.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">当前筛选条件下没有账户</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">删除确认</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">删除 OCI 账户</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">确定要删除账户“{pendingDelete.name}”吗？删除后该账户将无法继续用于实例、创建、容量等主链路。</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setPendingDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={() => void handleDelete(pendingDelete.id)} disabled={deletingId === pendingDelete.id} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">{deletingId === pendingDelete.id ? "删除中..." : "确认删除"}</button>
            </div>
          </section>
        </div>
      ) : null}
      {editingAccountId ? <EditAccountForm accountId={editingAccountId} onClose={() => setEditingAccountId(null)} onSaved={(updatedAccount) => { setEditingAccountId(null); pushToast({ tone: "success", message: "账户已更新" }); onAccountsChange?.((current) => current.map((account) => {
        if (account.id === updatedAccount.id) {
          return {
            ...account,
            ...updatedAccount,
            status: account.status,
            instanceCount: account.instanceCount,
            runningCount: account.runningCount,
            stoppedCount: account.stoppedCount,
          };
        }
        if (updatedAccount.isDefault && account.isDefault) {
          return { ...account, isDefault: false };
        }
        return account;
      })); }} /> : null}
    </>
  );
}
