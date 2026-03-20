"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.message || "注册失败");
      setLoading(false);
      return;
    }

    setMessage("注册成功，正在登录...");
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">OCI Platform</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">注册平台账户</h1>
        <p className="mt-2 text-sm text-slate-500">注册后即可绑定你自己的 OCI 账户。</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">昵称</label>
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">邮箱</label>
            <input type="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

          <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
