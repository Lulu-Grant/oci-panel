import { getAccountById } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";
import { createComputeClient } from "@/lib/oci";

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const accountId = body?.accountId as string | undefined;
  const instanceId = body?.instanceId as string | undefined;
  const action = body?.action as "START" | "STOP" | "SOFTRESET" | undefined;

  if (!accountId || !instanceId || !action) {
    return Response.json({ success: false, message: "缺少 accountId / instanceId / action" }, { status: 400 });
  }

  const account = await getAccountById(auth.userId, accountId);

  if (!account) {
    return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
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

    return Response.json({
      success: true,
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

    return Response.json({ success: false, message }, { status: 500 });
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
