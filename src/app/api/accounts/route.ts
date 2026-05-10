import {
  createAccount,
  deleteAccount,
  getAccountById,
  listAccounts,
  setAccountActiveState,
  setDefaultAccount,
  updateAccount,
} from "@/lib/accounts-store";
import { apiFail, apiOk } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";

function toSafeAccountDetail(account: Awaited<ReturnType<typeof getAccountById>>) {
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    tenancy: account.tenancy,
    userOcid: account.userOcid,
    fingerprint: account.fingerprint,
    keyFilePath: account.keyFilePath || "",
    region: account.region,
    description: account.description || "",
    isDefault: account.isDefault,
    isActive: account.isActive,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    hasPrivateKey: Boolean(account.privateKey?.trim()),
    hasPassphrase: Boolean(account.passphrase?.trim()),
  };
}

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (accountId) {
    const account = await getAccountById(auth.userId, accountId);
    if (!account) {
      return apiFail("账户不存在", 404);
    }
    return apiOk(toSafeAccountDetail(account));
  }

  const accounts = await listAccounts(auth.userId);

  const mapped = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    tenancy: account.tenancy,
    region: account.region,
    status: account.isActive ? "healthy" : "warning",
    instanceCount: 0,
    lastSync: "未同步",
    isDefault: account.isDefault,
  }));

  return apiOk(mapped);
}

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const body = await request.json();

  if (!body?.name || !body?.tenancy || !body?.userOcid || !body?.fingerprint || !body?.region) {
    return apiFail("缺少必填字段", 400);
  }

  if (!body?.privateKey && !body?.keyFilePath) {
    return apiFail("需要提供私钥内容或 key 文件路径", 400);
  }

  try {
    const created = await createAccount(auth.userId, {
      name: body.name,
      tenancy: body.tenancy,
      userOcid: body.userOcid,
      fingerprint: body.fingerprint,
      privateKey: body.privateKey || "",
      keyFilePath: body.keyFilePath || "",
      region: body.region,
      passphrase: body.passphrase || "",
      description: body.description || "",
      isDefault: Boolean(body.isDefault),
      isActive: true,
    });

    await appendLog({
      userId: auth.userId,
      ociAccountId: created.id,
      account: created.name,
      instance: "-",
      action: "账户创建",
      result: "success",
      message: `已创建 OCI 账户：${created.name}`,
    });

    return apiOk({ id: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建账户失败";
    return apiFail(message, 500);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const body = await request.json();
  const accountId = body?.accountId as string | undefined;
  const action = body?.action as string | undefined;

  if (!accountId || !action) {
    return apiFail("缺少 accountId 或 action", 400);
  }

  try {
    if (action === "setDefault") {
      const account = await setDefaultAccount(auth.userId, accountId);
      await appendLog({
        userId: auth.userId,
        ociAccountId: account.id,
        account: account.name,
        instance: "-",
        action: "账户设为默认",
        result: "success",
        message: `已设为默认账户：${account.name}`,
      });
      return apiOk({ accountId: account.id, isDefault: account.isDefault });
    }

    if (action === "setActive") {
      const isActive = Boolean(body?.isActive);
      const account = await setAccountActiveState(auth.userId, accountId, isActive);
      await appendLog({
        userId: auth.userId,
        ociAccountId: account.id,
        account: account.name,
        instance: "-",
        action: isActive ? "账户启用" : "账户停用",
        result: "success",
        message: `${isActive ? "已启用" : "已停用"} OCI 账户：${account.name}`,
      });
      return apiOk({ accountId: account.id, isActive: account.isActive, isDefault: account.isDefault });
    }

    if (action === "update") {
      if (!body?.name || !body?.tenancy || !body?.userOcid || !body?.fingerprint || !body?.region) {
        return apiFail("缺少必填字段", 400);
      }

      const replaceCredential = Boolean(body?.replaceCredential);
      if (replaceCredential && !body?.privateKey && !body?.keyFilePath) {
        return apiFail("替换凭据时需要提供私钥内容或 key 文件路径", 400);
      }

      const account = await updateAccount(auth.userId, accountId, {
        name: body.name,
        tenancy: body.tenancy,
        userOcid: body.userOcid,
        fingerprint: body.fingerprint,
        keyFilePath: body.keyFilePath || "",
        region: body.region,
        description: body.description || "",
        isDefault: Boolean(body.isDefault),
        isActive: body.isActive !== false,
        replaceCredential,
        privateKey: replaceCredential ? body.privateKey || "" : undefined,
        passphrase: replaceCredential ? body.passphrase || "" : undefined,
      });

      await appendLog({
        userId: auth.userId,
        ociAccountId: account.id,
        account: account.name,
        instance: "-",
        action: replaceCredential ? "账户更新凭据" : "账户更新",
        result: "success",
        message: replaceCredential ? `已更新账户资料并替换凭据：${account.name}` : `已更新账户资料：${account.name}`,
      });

      return apiOk({ accountId: account.id });
    }

    return apiFail("action 不支持", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "账户操作失败";
    return apiFail(message, 500);
  }
}


export async function DELETE(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return apiFail("缺少 accountId", 400);
  }

  try {
    const account = await getAccountById(auth.userId, accountId);
    const result = await deleteAccount(auth.userId, accountId);
    await appendLog({
      userId: auth.userId,
      ociAccountId: null,
      account: account?.name || "-",
      instance: account?.name || "-",
      action: "账户删除",
      result: "success",
      message: `已删除 OCI 账户：${account?.name || accountId}`,
    });
    return apiOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除账户失败";
    return apiFail(message, 500);
  }
}
