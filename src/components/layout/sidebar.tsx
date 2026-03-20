import Link from "next/link";

const navItems = [
  { label: "控制台", href: "/" },
  { label: "账户管理", href: "/accounts" },
  { label: "实例管理", href: "/instances" },
  { label: "额度与资源", href: "/capacity" },
  { label: "创建实例", href: "/create" },
  { label: "操作日志", href: "/logs" },
  { label: "设置", href: "/settings" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[#0f172a] px-5 py-6 text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-400/70">OCI 面板</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">资产控制台</h1>
        <p className="mt-2 text-sm text-slate-400">在一个页面里更快地管理多个 Oracle Cloud 账户与实例。</p>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">当前阶段</p>
        <p className="mt-2 text-sm text-slate-200">MVP 聚焦：账户、实例、额度查询、创建资源选择、日志。</p>
      </div>
    </aside>
  );
}
