import { listAccounts, pickDefaultAccount } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { listLogs } from "@/lib/logs-store";
import { createComputeClient, createVirtualNetworkClient } from "@/lib/oci";
import { DashboardData, InstanceItem } from "@/types/dashboard";

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  const accounts = await listAccounts(auth.userId);
  const selectedAccount = accountId ? accounts.find((item) => item.id === accountId) : pickDefaultAccount(accounts);
  const logs = await listLogs(auth.userId);

  if (!selectedAccount) {
    const empty: DashboardData = { accounts: [], instances: [], logs: logs.slice(0, 8) };
    return Response.json(empty);
  }

  const instances: InstanceItem[] = [];

  try {
    const computeClient = await createComputeClient(selectedAccount);
    const networkClient = await createVirtualNetworkClient(selectedAccount);
    const response = await computeClient.listInstances({ compartmentId: selectedAccount.tenancy });

    for (const item of response.items || []) {
      const networking = await getInstanceNetworking(computeClient, networkClient, selectedAccount.tenancy, item.id || "");
      const hasPublicIp = networking.ipv4 !== "-" && networking.ipv4 === networking.publicIp;
      const isDualStack = networking.ipv6 !== "-";
      const isFlexShape = (item.shape || "").toUpperCase().includes("FLEX");
      const riskFlags = [
        hasPublicIp ? "公网暴露" : null,
        isDualStack ? "双栈启用" : null,
        mapLifecycleState(item.lifecycleState) === "error" ? "状态异常" : null,
      ].filter(Boolean) as string[];

      instances.push({
        id: item.id || `${selectedAccount.id}-${item.displayName}`,
        accountId: selectedAccount.id,
        name: item.displayName || "Unnamed instance",
        accountName: selectedAccount.name,
        region: selectedAccount.region,
        status: mapLifecycleState(item.lifecycleState),
        ip: networking.ipv4,
        ipv6: networking.ipv6,
        shape: item.shape || "-",
        hasPublicIp,
        isDualStack,
        isFlexShape,
        riskFlags,
      });
    }
  } catch (error) {
    instances.push({
      id: `error-${selectedAccount.id}`,
      accountId: selectedAccount.id,
      name: `读取失败：${selectedAccount.name}`,
      accountName: selectedAccount.name,
      region: selectedAccount.region,
      status: "error",
      ip: "-",
      ipv6: "-",
      shape: error instanceof Error ? error.message : "未知错误",
      hasPublicIp: false,
      isDualStack: false,
      isFlexShape: false,
      riskFlags: ["账户读取失败"],
    });
  }

  const dashboard: DashboardData = {
    accounts: [
      {
        id: selectedAccount.id,
        name: selectedAccount.name,
        tenancy: selectedAccount.tenancy,
        region: selectedAccount.region,
        status: selectedAccount.isActive ? "healthy" : "warning",
        instanceCount: instances.filter((item) => !item.id.startsWith("error-")).length,
        runningCount: instances.filter((item) => item.status === "running").length,
        stoppedCount: instances.filter((item) => item.status === "stopped").length,
        lastSync: new Date().toISOString(),
        isDefault: selectedAccount.isDefault,
      },
    ],
    instances,
    logs: logs.filter((item) => item.account === selectedAccount.name).slice(0, 8),
  };

  return Response.json(dashboard);
}

async function getInstanceNetworking(
  computeClient: Awaited<ReturnType<typeof createComputeClient>>,
  networkClient: Awaited<ReturnType<typeof createVirtualNetworkClient>>,
  compartmentId: string,
  instanceId: string
) {
  if (!instanceId) return { ipv4: "-", ipv6: "-", publicIp: "-" };

  try {
    const vnicAttachments = await computeClient.listVnicAttachments({ compartmentId, instanceId });
    const attachment = (vnicAttachments.items || [])[0];
    if (!attachment?.vnicId) return { ipv4: "-", ipv6: "-", publicIp: "-" };

    const vnic = await networkClient.getVnic({ vnicId: attachment.vnicId });
    const publicIp = vnic.vnic.publicIp || "-";
    const ipv4 = vnic.vnic.publicIp || vnic.vnic.privateIp || "-";

    let ipv6 = "-";
    try {
      const ipv6s = await networkClient.listIpv6s({ vnicId: attachment.vnicId });
      const firstIpv6 = (ipv6s.items || [])[0];
      if (firstIpv6?.ipAddress) ipv6 = firstIpv6.ipAddress;
    } catch {
      ipv6 = "-";
    }

    return { ipv4, ipv6, publicIp };
  } catch {
    return { ipv4: "-", ipv6: "-", publicIp: "-" };
  }
}

function mapLifecycleState(state?: string | null) {
  switch (state) {
    case "RUNNING":
      return "running";
    case "STOPPED":
      return "stopped";
    case "STARTING":
      return "starting";
    case "STOPPING":
      return "stopping";
    default:
      return "error";
  }
}
