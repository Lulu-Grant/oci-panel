import Link from "next/link";

const actions = [
  {
    title: "创建实例",
    desc: "进入创建工作流，结合 shape / 镜像 / 网络 / capacity 提示完成实例下发。",
    href: "/create",
  },
  {
    title: "查看实例资产",
    desc: "按公网、双栈、Flex 与风险标签审视当前账户实例资产。",
    href: "/instances",
  },
  {
    title: "查看 Capacity",
    desc: "核对配额、重点 Compute 服务与创建前可行性参考。",
    href: "/capacity",
  },
  {
    title: "管理 OCI 账户",
    desc: "新增、测试连接、设置默认账户，完善多账户平台基础。",
    href: "/accounts",
  },
];

export function QuickActions() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">快捷入口</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">快速进入核心工作流</h3>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <p className="text-sm font-semibold text-slate-900">{action.title}</p>
            <p className="mt-2 text-sm text-slate-600">{action.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
