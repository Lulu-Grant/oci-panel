import { getAccountById } from "@/lib/accounts-store";
import { apiFail, apiOk } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth";
import { createOsManagementHubManagedInstanceClient } from "@/lib/oci";

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const instanceId = searchParams.get("instanceId");

  if (!accountId || !instanceId) {
    return apiFail("缺少 accountId 或 instanceId", 400);
  }

  const account = await getAccountById(auth.userId, accountId);
  if (!account) {
    return apiFail("账户不存在", 404);
  }
  if (!account.isActive) {
    return apiFail("账户已停用，请先启用后再检测托管能力", 409);
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
      return apiOk({
        supported: false,
        mode: "os-management-hub",
        reason: "当前实例未出现在 OS Management Hub 的 managed instances 中，可能尚未启用代理、未注册托管实例或权限不足。",
      });
    }

    return apiOk({
      supported: true,
      mode: "os-management-hub",
      managedInstanceId: String(matched.id || matched.managedInstanceId || instanceId),
      displayName: String(matched.displayName || "-"),
      status: String(matched.status || "-"),
      reason: "已识别为 OS Management Hub 托管实例，可进入下一步任务编排。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测 OCI 原生命令执行能力失败";
    return apiFail(message, 500);
  }
}
