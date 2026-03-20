import { getAccountById } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";
import { createIdentityClient } from "@/lib/oci";

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const accountId = body?.accountId as string | undefined;

  if (!accountId) {
    return Response.json({ success: false, message: "缺少 accountId" }, { status: 400 });
  }

  const account = await getAccountById(auth.userId, accountId);

  if (!account) {
    return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
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

    return Response.json({
      success: true,
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

    return Response.json({ success: false, message }, { status: 500 });
  }
}
