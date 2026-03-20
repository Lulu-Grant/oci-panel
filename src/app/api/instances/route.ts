import { listAccounts, pickDefaultAccount } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { createComputeClient, createVirtualNetworkClient } from "@/lib/oci";
import { InstanceItem } from "@/types/dashboard";

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  const accounts = await listAccounts(auth.userId);
  const defaultAccount = pickDefaultAccount(accounts);
  const targetAccounts = accountId
    ? accounts.filter((item) => item.id === accountId)
    : (defaultAccount ? [defaultAccount] : []);

  if (targetAccounts.length === 0) {
    return Response.json([]);
  }

  const results: InstanceItem[] = [];

  for (const account of targetAccounts) {
    try {
      const computeClient = await createComputeClient(account);
      const networkClient = await createVirtualNetworkClient(account);
      const response = await computeClient.listInstances({ compartmentId: account.tenancy });

      for (const item of response.items || []) {
        const networking = await getInstanceNetworking(computeClient, networkClient, account.tenancy, item.id || "");
        const hasPublicIp = Boolean(networking.ipv4 && networking.ipv4 !== "-" && networking.ipv4 === networking.publicIp);
        const isDualStack = Boolean(networking.ipv6 && networking.ipv6 !== "-");
        const isFlexShape = Boolean(item.shape && /flex/i.test(item.shape));
        const riskFlags = [
          !hasPublicIp ? "无公网 IPv4" : null,
          !isDualStack ? "无 IPv6" : null,
          isFlexShape ? "Flex" : null,
        ].filter(Boolean) as string[];

        results.push({
          id: item.id || `${account.id}-${item.displayName}`,
          accountId: account.id,
          name: item.displayName || "Unnamed instance",
          accountName: account.name,
          region: account.region,
          status: mapLifecycleState(item.lifecycleState),
          ip: networking.ipv4 || "-",
          ipv6: networking.ipv6 || "-",
          shape: item.shape || "-",
          hasPublicIp,
          isDualStack,
          isFlexShape,
          riskFlags,
        });
      }
    } catch (error) {
      results.push({
        id: `error-${account.id}`,
        accountId: account.id,
        name: `读取失败：${account.name}`,
        accountName: account.name,
        region: account.region,
        status: "error",
        ip: "-",
        ipv6: "-",
        shape: error instanceof Error ? error.message : "未知错误",
        hasPublicIp: false,
        isDualStack: false,
        isFlexShape: false,
        riskFlags: ["读取失败"],
      });
    }
  }

  return Response.json(results);
}

async function getInstanceNetworking(
  computeClient: Awaited<ReturnType<typeof createComputeClient>>,
  networkClient: Awaited<ReturnType<typeof createVirtualNetworkClient>>,
  compartmentId: string,
  instanceId: string
) {
  if (!instanceId) return { ipv4: "-", publicIp: "-", ipv6: "-" };

  try {
    const vnicAttachments = await computeClient.listVnicAttachments({ compartmentId, instanceId });
    const attachment = (vnicAttachments.items || [])[0];
    if (!attachment?.vnicId) return { ipv4: "-", publicIp: "-", ipv6: "-" };

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

    return { ipv4, publicIp, ipv6 };
  } catch {
    return { ipv4: "-", publicIp: "-", ipv6: "-" };
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
