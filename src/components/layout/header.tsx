"use client";

import { signOut } from "next-auth/react";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Oracle Cloud 资产控制台</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">更快地管理你的 OCI 资产</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          当前版本：<span className="font-semibold text-slate-900">多账户选择已接入</span>
        </div>
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          退出登录
        </button>
      </div>
    </header>
  );
}
