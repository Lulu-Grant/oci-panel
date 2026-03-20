import { getAccountById } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";
import { createComputeClient, createIdentityClient } from "@/lib/oci";
import oci from "oci-sdk";

interface LaunchInstancePayload {
  accountId?: string;
  availabilityDomain?: string;
  subnetId?: string;
  imageId?: string;
  shape?: string;
  displayName?: string;
  assignPublicIp?: boolean;
  ipMode?: "ipv4" | "dual";
  sshAuthorizedKeys?: string;
  ocpus?: number;
  memoryInGBs?: number;
  loginMode?: "generated-ssh" | "manual-ssh" | "password";
  username?: string;
  password?: string;
  allowRootLogin?: boolean;
  enablePasswordAuth?: boolean;
}

function isSshKeyFormatValid(value?: string) {
  if (!value?.trim()) return true;
  return /^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521))\s+.+/.test(value.trim());
}

function isSafeUsername(value?: string) {
  if (!value) return false;
  return /^[a-z_][a-z0-9_-]{0,31}$/i.test(value);
}

function isStrongEnoughPassword(value?: string) {
  if (!value) return false;
  return value.length >= 8;
}

function buildCloudInit(params: { username: string; password: string; allowRootLogin?: boolean; enablePasswordAuth?: boolean }) {
  const escapedPassword = params.password.replace(/"/g, '\\"');
  const username = params.username;
  const passwordAuth = params.enablePasswordAuth !== false;
  const allowRoot = Boolean(params.allowRootLogin);

  const lines = [
    "#cloud-config",
    "ssh_pwauth: true",
    `disable_root: ${allowRoot ? "false" : "true"}`,
    "chpasswd:",
    "  expire: false",
    "users:",
    `  - name: ${username}`,
    "    sudo: ALL=(ALL) NOPASSWD:ALL",
    "    shell: /bin/bash",
    `    lock_passwd: false`,
    `    passwd: ${escapedPassword}`,
    "runcmd:",
    `  - sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication ${passwordAuth ? "yes" : "no"}/' /etc/ssh/sshd_config || true`,
    `  - sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin ${allowRoot ? "yes" : "no"}/' /etc/ssh/sshd_config || true`,
    "  - systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart || true",
  ];

  if (allowRoot) {
    lines.splice(6, 0, `  - name: root`, `    lock_passwd: false`, `    passwd: ${escapedPassword}`);
  }

  return Buffer.from(lines.join("\n"), "utf8").toString("base64");
}

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const body = (await request.json()) as LaunchInstancePayload;

  if (!body.accountId || !body.availabilityDomain || !body.subnetId || !body.imageId || !body.shape || !body.displayName) {
    return Response.json({ success: false, message: "缺少必填字段：accountId / availabilityDomain / subnetId / imageId / shape / displayName" }, { status: 400 });
  }

  const displayName = body.displayName.trim();
  if (!displayName) {
    return Response.json({ success: false, message: "实例名不能为空" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(displayName)) {
    return Response.json({ success: false, message: "实例名只允许 1-64 位字母、数字、点、下划线、短横线" }, { status: 400 });
  }

  const loginMode = body.loginMode || (body.sshAuthorizedKeys?.trim() ? "manual-ssh" : "generated-ssh");

  if ((loginMode === "manual-ssh" || loginMode === "generated-ssh") && !isSshKeyFormatValid(body.sshAuthorizedKeys)) {
    return Response.json({ success: false, message: "SSH 公钥格式不正确，请粘贴标准 ssh-rsa / ssh-ed25519 / ecdsa 公钥" }, { status: 400 });
  }

  if (loginMode === "password") {
    if (!isSafeUsername(body.username)) {
      return Response.json({ success: false, message: "用户名格式不合法，请使用 1-32 位字母、数字、下划线或短横线，并以字母或下划线开头" }, { status: 400 });
    }
    if (!isStrongEnoughPassword(body.password)) {
      return Response.json({ success: false, message: "密码至少需要 8 位" }, { status: 400 });
    }
  }

  const isFlexShape = /flex/i.test(body.shape);
  if (isFlexShape) {
    if (typeof body.ocpus !== "number" || Number.isNaN(body.ocpus) || body.ocpus <= 0) {
      return Response.json({ success: false, message: "Flex 规格必须填写有效的 OCPU" }, { status: 400 });
    }
    if (typeof body.memoryInGBs !== "number" || Number.isNaN(body.memoryInGBs) || body.memoryInGBs <= 0) {
      return Response.json({ success: false, message: "Flex 规格必须填写有效的内存大小（GB）" }, { status: 400 });
    }
  }

  const account = await getAccountById(auth.userId, body.accountId);

  if (!account) {
    return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
  }

  try {
    const [identityClient, computeClient] = await Promise.all([
      createIdentityClient(account),
      createComputeClient(account),
    ]);

    const adsRes = await identityClient.listAvailabilityDomains({ compartmentId: account.tenancy });
    const validAds = new Set((adsRes.items || []).map((item) => item.name).filter(Boolean));
    if (!validAds.has(body.availabilityDomain)) {
      return Response.json({ success: false, message: "所选可用域不存在或不属于当前账户区域" }, { status: 400 });
    }

    const metadata = body.sshAuthorizedKeys?.trim()
      ? { ssh_authorized_keys: body.sshAuthorizedKeys.trim() }
      : undefined;

    const extendedMetadata = loginMode === "password"
      ? {
          user_data: buildCloudInit({
            username: body.username || "opc",
            password: body.password || "",
            allowRootLogin: body.allowRootLogin,
            enablePasswordAuth: body.enablePasswordAuth,
          }),
        }
      : undefined;

    const launchInstanceDetails: Record<string, unknown> = {
      compartmentId: account.tenancy,
      availabilityDomain: body.availabilityDomain,
      displayName,
      shape: body.shape,
      metadata,
      extendedMetadata,
      sourceDetails: {
        sourceType: "image",
        imageId: body.imageId,
      },
      createVnicDetails: {
        subnetId: body.subnetId,
        assignPublicIp: body.assignPublicIp !== false,
        assignIpv6Ip: body.ipMode === "dual",
      },
    };

    if (typeof body.ocpus === "number" || typeof body.memoryInGBs === "number") {
      launchInstanceDetails.shapeConfig = {
        ...(typeof body.ocpus === "number" ? { ocpus: body.ocpus } : {}),
        ...(typeof body.memoryInGBs === "number" ? { memoryInGBs: body.memoryInGBs } : {}),
      };
    }

    const response = await computeClient.launchInstance({
      launchInstanceDetails: launchInstanceDetails as oci.core.models.LaunchInstanceDetails,
    });
    const instance = response.instance;

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      instanceId: instance?.id || null,
      time: new Date().toISOString(),
      user: auth.userId,
      account: account.name,
      instance: instance?.displayName || displayName,
      action: "创建实例",
      result: "success",
      message: `创建请求已提交：${instance?.id || "未知实例ID"}`,
    });

    return Response.json({
      success: true,
      message: "创建请求已提交",
      instance: {
        id: instance?.id,
        name: instance?.displayName,
        lifecycleState: instance?.lifecycleState,
        shape: instance?.shape,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建实例失败";

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      time: new Date().toISOString(),
      user: auth.userId,
      account: account.name,
      instance: displayName || "未命名实例",
      action: "创建实例",
      result: "failed",
      message,
    });

    return Response.json({ success: false, message }, { status: 500 });
  }
}
