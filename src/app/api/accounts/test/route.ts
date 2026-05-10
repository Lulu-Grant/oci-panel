import { getAccountById } from "@/lib/accounts-store";
import { apiFail, apiOk } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";
import { createIdentityClient } from "@/lib/oci";

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const body = await request.json();
  const accountId = body?.accountId as string | undefined;

  if (!accountId) {
    return apiFail("缺少 accountId", 400);
  }

  const account = await getAccountById(auth.userId, accountId);

  if (!account) {
    return apiFail("账户不存在", 404);
  }
  if (!account.isActive) {
    return apiFail("账户已停用，请先启用后再测试连接", 409);
  }

  try {
    const client = await createIdentityClient(account);
    const response = await client.getTenancy({ tenancyId: account.tenancy });

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      time: new Date().toISOString(),
      user: auth.userId,
      account: account.name,
      instance: "-",
      action: "测试账户",
      result: "success",
      message: `连接测试成功：${response.tenancy.name}`,
    });

    return apiOk({
      tenancyName: response.tenancy.name,
      tenancyId: response.tenancy.id,
      region: account.region,
      message: "连接测试成功",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接测试失败";

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      time: new Date().toISOString(),
      user: auth.userId,
      account: account.name,
      instance: "-",
      action: "测试账户",
      result: "failed",
      message,
    });

    return apiFail(message, 500);
  }
}
