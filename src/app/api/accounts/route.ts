import {
  createAccount,
  deleteAccount,
  getAccountById,
  listAccounts,
  setAccountActiveState,
  setDefaultAccount,
  updateAccount,
} from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (accountId) {
    const account = await getAccountById(auth.userId, accountId);
    if (!account) {
      return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
    }
    return Response.json(account);
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

  return Response.json(mapped);
}

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const body = await request.json();

  if (!body?.name || !body?.tenancy || !body?.userOcid || !body?.fingerprint || !body?.region) {
    return Response.json({ success: false, message: "缺少必填字段" }, { status: 400 });
  }

  if (!body?.privateKey && !body?.keyFilePath) {
    return Response.json({ success: false, message: "需要提供私钥内容或 key 文件路径" }, { status: 400 });
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

    return Response.json({ success: true, id: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建账户失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const accountId = body?.accountId as string | undefined;
  const action = body?.action as string | undefined;

  if (!accountId || !action) {
    return Response.json({ success: false, message: "缺少 accountId 或 action" }, { status: 400 });
  }

  try {
    if (action === "setDefault") {
      const account = await setDefaultAccount(auth.userId, accountId);
      return Response.json({ success: true, accountId: account.id, isDefault: account.isDefault });
    }

    if (action === "setActive") {
      const isActive = Boolean(body?.isActive);
      const account = await setAccountActiveState(auth.userId, accountId, isActive);
      return Response.json({ success: true, accountId: account.id, isActive: account.isActive, isDefault: account.isDefault });
    }

    if (action === "update") {
      if (!body?.name || !body?.tenancy || !body?.userOcid || !body?.fingerprint || !body?.region) {
        return Response.json({ success: false, message: "缺少必填字段" }, { status: 400 });
      }

      if (!body?.privateKey && !body?.keyFilePath) {
        return Response.json({ success: false, message: "需要提供私钥内容或 key 文件路径" }, { status: 400 });
      }

      const account = await updateAccount(auth.userId, accountId, {
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
        isActive: body.isActive !== false,
      });

      return Response.json({ success: true, accountId: account.id });
    }

    return Response.json({ success: false, message: "action 不支持" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "账户操作失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return Response.json({ success: false, message: "缺少 accountId" }, { status: 400 });
  }

  try {
    const result = await deleteAccount(auth.userId, accountId);
    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除账户失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
