import { listAccounts, pickDefaultAccount } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { createComputeClient } from "@/lib/oci";

export async function GET() {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const accounts = await listAccounts(auth.userId);

  const results = await Promise.all(accounts.map(async (account) => {
    let instanceCount = 0;
    let runningCount = 0;
    let stoppedCount = 0;
    let status: "healthy" | "warning" | "error" = account.isActive ? "healthy" : "warning";
    let lastSync = account.updatedAt || "未同步";

    try {
      const computeClient = await createComputeClient(account);
      const response = await computeClient.listInstances({ compartmentId: account.tenancy });
      const instances = response.items || [];
      instanceCount = instances.length;
      runningCount = instances.filter((item) => item.lifecycleState === "RUNNING").length;
      stoppedCount = instances.filter((item) => item.lifecycleState === "STOPPED").length;
      lastSync = new Date().toISOString();
    } catch {
      status = "error";
    }

    return {
      id: account.id,
      name: account.name,
      tenancy: account.tenancy,
      region: account.region,
      status,
      instanceCount,
      runningCount,
      stoppedCount,
      lastSync,
      isDefault: account.isDefault,
    };
  }));

  const defaultAccount = pickDefaultAccount(accounts);
  const sorted = [...results].sort((a, b) => {
    if (a.id === defaultAccount?.id) return -1;
    if (b.id === defaultAccount?.id) return 1;
    return 0;
  });

  return Response.json(sorted);
}
