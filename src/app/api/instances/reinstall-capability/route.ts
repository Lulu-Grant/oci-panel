import { getAccountById } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { createOsManagementHubManagedInstanceClient } from "@/lib/oci";

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const instanceId = searchParams.get("instanceId");

  if (!accountId || !instanceId) {
    return Response.json({ success: false, message: "缺少 accountId 或 instanceId" }, { status: 400 });
  }

  const account = await getAccountById(auth.userId, accountId);
  if (!account) {
    return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
  }

  try {
    const client = await createOsManagementHubManagedInstanceClient(account);

    const direct = await client.listManagedInstances({
      compartmentId: account.tenancy,
      managedInstanceId: instanceId,
    });

    const directItems = ((direct as unknown as { managedInstanceCollection?: { items?: Array<Record<string, unknown>> } }).managedInstanceCollection?.items || []) as Array<Record<string, unknown>>;
    const matched = directItems[0];

    if (!matched) {
      return Response.json({
        success: true,
        supported: false,
        mode: "os-management-hub",
        reason: "当前实例未出现在 OS Management Hub 的 managed instances 中，可能尚未启用代理、未注册托管实例或权限不足。",
      });
    }

    return Response.json({
      success: true,
      supported: true,
      mode: "os-management-hub",
      managedInstanceId: String(matched.id || matched.managedInstanceId || instanceId),
      displayName: String(matched.displayName || "-"),
      status: String(matched.status || "-"),
      reason: "已识别为 OS Management Hub 托管实例，可进入下一步任务编排。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测 OCI 原生命令执行能力失败";
    return Response.json({ success: false, supported: false, mode: "os-management-hub", message }, { status: 500 });
  }
}
