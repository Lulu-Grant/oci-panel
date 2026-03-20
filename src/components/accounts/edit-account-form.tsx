"use client";

import { useEffect, useState } from "react";
import { CreateAccountPayload } from "@/types/accounts";
import { AccountItem } from "@/types/dashboard";

const initialForm: CreateAccountPayload = {
  name: "",
  tenancy: "",
  userOcid: "",
  fingerprint: "",
  privateKey: "",
  keyFilePath: "",
  region: "ap-singapore-1",
  passphrase: "",
  description: "",
  isDefault: false,
};

export function EditAccountForm({
  accountId,
  onClose,
  onSaved,
}: {
  accountId: string;
  onClose: () => void;
  onSaved: (account: AccountItem) => void;
}) {
  const [form, setForm] = useState<CreateAccountPayload>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [keepExistingKey, setKeepExistingKey] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounts?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "加载账户详情失败");
        setForm({
          name: data.name || "",
          tenancy: data.tenancy || "",
          userOcid: data.userOcid || "",
          fingerprint: data.fingerprint || "",
          privateKey: data.privateKey || "",
          keyFilePath: data.keyFilePath || "",
          region: data.region || "ap-singapore-1",
          passphrase: data.passphrase || "",
          description: data.description || "",
          isDefault: Boolean(data.isDefault),
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "加载账户详情失败");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [accountId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const payload = { ...form, privateKey: keepExistingKey ? form.privateKey : form.privateKey };
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, action: "update", ...payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "更新账户失败");
      onSaved({
        id: accountId,
        name: payload.name,
        tenancy: payload.tenancy,
        region: payload.region,
        status: "healthy",
        instanceCount: 0,
        runningCount: 0,
        stoppedCount: 0,
        lastSync: new Date().toISOString(),
        isDefault: Boolean(payload.isDefault),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新账户失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">编辑账户</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">更新 Oracle API 凭据</h3>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">关闭</button>
        </div>
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">正在加载账户详情...</div> : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="账户别名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="区域，如 ap-singapore-1" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Tenancy OCID" value={form.tenancy} onChange={(e) => setForm({ ...form, tenancy: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="User OCID" value={form.userOcid} onChange={(e) => setForm({ ...form, userOcid: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Fingerprint" value={form.fingerprint} onChange={(e) => setForm({ ...form, fingerprint: e.target.value })} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={keepExistingKey} onChange={(e) => setKeepExistingKey(e.target.checked)} /> 保留现有私钥</label>
              <p className="mt-2 text-xs text-slate-500">默认不直接展开完整私钥，只有你明确需要替换时再粘贴新私钥。</p>
            </div>
            {!keepExistingKey ? <textarea className="min-h-40 rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Private Key（可直接粘贴 PEM 内容）" value={form.privateKey} onChange={(e) => setForm({ ...form, privateKey: e.target.value })} /> : null}
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Key 文件路径（可选）" value={form.keyFilePath} onChange={(e) => setForm({ ...form, keyFilePath: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Passphrase（可选）" value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="备注（可选）" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />设为默认账户</label>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">编辑时同样支持二选一：保留原私钥，或显式替换为新私钥 / key 文件路径。</div>
            <div className="flex items-center gap-3">
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50" disabled={submitting}>{submitting ? "保存中..." : "保存修改"}</button>
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">取消</button>
              {message ? <p className="text-sm text-slate-500">{message}</p> : null}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
