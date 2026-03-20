"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateAccountPayload } from "@/types/accounts";

function parseOracleConfigText(raw: string): Partial<CreateAccountPayload> {
  const result: Partial<CreateAccountPayload> = {};
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("#")) continue;
    const commentRemoved = trimmed.split("#")[0]?.trim() || "";
    const eqIndex = commentRemoved.indexOf("=");
    if (eqIndex === -1) continue;

    const key = commentRemoved.slice(0, eqIndex).trim().toLowerCase();
    const value = commentRemoved.slice(eqIndex + 1).trim();
    if (!value) continue;

    if (key === "user") result.userOcid = value;
    if (key === "fingerprint") result.fingerprint = value;
    if (key === "tenancy") result.tenancy = value;
    if (key === "region") result.region = value;
    if (key === "key_file") result.keyFilePath = value;
    if (key === "pass_phrase" || key === "passphrase") result.passphrase = value;
  }

  return result;
}

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

export function AddAccountForm({
  defaultValues,
  onSaved,
}: {
  defaultValues?: Partial<CreateAccountPayload>;
  onSaved?: (payload: { id: string; account: CreateAccountPayload }) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CreateAccountPayload>({
    ...initialForm,
    ...defaultValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  function handleImportConfig() {
    try {
      const parsed = parseOracleConfigText(importText);
      setForm((prev) => ({
        ...prev,
        tenancy: parsed.tenancy || prev.tenancy,
        userOcid: parsed.userOcid || prev.userOcid,
        fingerprint: parsed.fingerprint || prev.fingerprint,
        region: parsed.region || prev.region,
        keyFilePath: parsed.keyFilePath || prev.keyFilePath,
        passphrase: parsed.passphrase || prev.passphrase,
      }));
      setMessage("已自动识别并填充 Oracle config 信息");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "解析配置失败");
    }
  }

  async function handleKeyFileUpload(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      setForm((prev) => ({
        ...prev,
        privateKey: text,
        keyFilePath: prev.keyFilePath || file.name,
      }));
      setMessage(`已读取私钥文件：${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取私钥文件失败");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = { ...form };
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "保存账户失败");
      }

      setMessage("账户已保存");
      setForm(initialForm);
      setImportText("");
      router.refresh();
      onSaved?.({ id: data.id, account: payload });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">添加账户</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">录入 Oracle API 凭据</h3>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">快速导入 OCI config</p>
          <p className="mt-1 text-sm text-slate-500">支持直接粘贴类似 ~/.oci/config 的 [DEFAULT] 配置片段，自动识别 user / fingerprint / tenancy / region / key_file。</p>
          <textarea
            className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            placeholder={`[DEFAULT]
user=ocid1.user...
fingerprint=xx:xx:xx
tenancy=ocid1.tenancy...
region=ap-singapore-2
key_file=/Users/name/.oci/oci_api_key.pem`}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={handleImportConfig} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              识别并填充
            </button>
            <p className="text-xs text-slate-500">不会自动填写私钥正文；若 key_file 存在会自动填入 Key 文件路径。</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="账户别名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="区域，如 ap-singapore-1" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>

        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Tenancy OCID" value={form.tenancy} onChange={(e) => setForm({ ...form, tenancy: e.target.value })} />
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="User OCID" value={form.userOcid} onChange={(e) => setForm({ ...form, userOcid: e.target.value })} />
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Fingerprint" value={form.fingerprint} onChange={(e) => setForm({ ...form, fingerprint: e.target.value })} />
        <textarea className="min-h-40 rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Private Key（可直接粘贴 PEM 内容）" value={form.privateKey} onChange={(e) => setForm({ ...form, privateKey: e.target.value })} />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Key 文件路径（可选，例如 /Users/name/key.pem）" value={form.keyFilePath} onChange={(e) => setForm({ ...form, keyFilePath: e.target.value })} />
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
            上传私钥文件
            <input type="file" accept=".pem,.key,.txt,application/x-pem-file" className="hidden" onChange={(e) => void handleKeyFileUpload(e.target.files?.[0] || null)} />
          </label>
        </div>
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Passphrase（可选）" value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })} />
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="备注（可选）" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          设为默认账户
        </label>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          可二选一：
          <br />
          1. 直接粘贴私钥内容到 Private Key
          <br />
          2. 或填写本机 key 文件路径
          <br />
          3. 或直接上传私钥文件（会自动读取并填入 Private Key）
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50" disabled={submitting}>
            {submitting ? "保存中..." : "保存账户"}
          </button>
          {message ? <p className="text-sm text-slate-500">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}
