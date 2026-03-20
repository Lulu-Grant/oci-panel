"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const googleEnabled = Boolean(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });

    if (result?.error) {
      setError("邮箱或密码错误");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">OCI Platform</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">登录平台账户</h1>
        <p className="mt-2 text-sm text-slate-500">登录后即可管理你自己的 OCI 账户与资产。</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">邮箱</label>
            <input type="email" autoComplete="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
            <input type="password" autoComplete="current-password" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {loading ? "登录中..." : "邮箱登录"}
          </button>
        </form>

        {googleEnabled ? (
          <button onClick={() => void signIn("google", { callbackUrl: "/" })} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            使用 Google 登录
          </button>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            当前环境未启用 Google 登录。
          </div>
        )}

        <p className="mt-6 text-sm text-slate-500">
          还没有账户？ <a className="font-medium text-slate-900" href="/register">去注册</a>
        </p>
      </section>
    </main>
  );
}
