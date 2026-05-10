import { getAccountById } from "@/lib/accounts-store";
import { apiFail, apiOk } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";
import { createComputeClient } from "@/lib/oci";

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const body = await request.json();
  const accountId = body?.accountId as string | undefined;
  const instanceId = body?.instanceId as string | undefined;
  const action = body?.action as "START" | "STOP" | "SOFTRESET" | undefined;

  if (!accountId || !instanceId || !action) {
    return apiFail("缺少 accountId / instanceId / action", 400);
  }

  const account = await getAccountById(auth.userId, accountId);

  if (!account) {
    return apiFail("账户不存在", 404);
  }
  if (!account.isActive) {
    return apiFail("账户已停用，请先启用后再执行实例操作", 409);
  }

  try {
    const computeClient = await createComputeClient(account);
    const response = await computeClient.instanceAction({ instanceId, action });

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      instanceId,
      time: new Date().toISOString(),
      user: auth.userId,
      account: account.name,
      instance: instanceId,
      action: mapActionLabel(action),
      result: "success",
      message: `实例操作成功，状态：${response.instance.lifecycleState}`,
    });

    return apiOk({
      status: response.instance.lifecycleState,
      message: `操作已提交：${action}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "实例操作失败";

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      instanceId,
      time: new Date().toISOString(),
      user: auth.userId,
      account: account.name,
      instance: instanceId,
      action: mapActionLabel(action),
      result: "failed",
      message,
    });

    return apiFail(message, 500);
  }
}

function mapActionLabel(action: "START" | "STOP" | "SOFTRESET") {
  switch (action) {
    case "START":
      return "开机";
    case "STOP":
      return "关机";
    case "SOFTRESET":
      return "重启";
    default:
      return action;
  }
}
