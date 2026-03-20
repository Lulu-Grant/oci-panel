import { AppShell } from "@/components/layout/app-shell";

export default function SettingsPage() {
  return (
    <AppShell>
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">设置</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">预留给下一阶段</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
          后续这里可以放用户设置、API 加密配置、通知能力，以及全局默认参数等功能。
        </p>
      </section>
    </AppShell>
  );
}
