import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAccountById } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { appendLog } from "@/lib/logs-store";

const execFileAsync = promisify(execFile);

interface ReinstallPayload {
  accountId?: string;
  instanceId?: string;
  instanceName?: string;
  host?: string;
  port?: number;
  username?: string;
  privateKey?: string;
  image?: string;
  password?: string;
  customImageUrl?: string;
  dryRun?: boolean;
}

const imagePresetMap: Record<string, string[]> = {
  "debian-12": ["-d", "12", "-p", "debian"],
  "ubuntu-24.04": ["-u", "24.04", "-p", "ubuntu"],
  "ubuntu-22.04": ["-u", "22.04", "-p", "ubuntu"],
  "centos-9": ["-c", "9", "-p", "centos"],
  "windows": ["-w"],
};

function isSafeHost(value?: string) {
  return !!value && /^[a-zA-Z0-9_.:-]+$/.test(value);
}

function isSafeUsername(value?: string) {
  return !!value && /^[a-z_][a-z0-9_-]{0,31}$/i.test(value);
}

function buildRemoteCommand(payload: ReinstallPayload) {
  const args = payload.image === "custom" && payload.customImageUrl
    ? [payload.customImageUrl]
    : imagePresetMap[payload.image || "ubuntu-22.04"] || imagePresetMap["ubuntu-22.04"];

  const parts = [
    "curl -fsSL https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh | bash -s --",
    ...args.map((item) => `'${item.replace(/'/g, "'\\''")}'`),
  ];

  if (payload.password) {
    parts.push(`'--password'`, `'${payload.password.replace(/'/g, "'\\''")}'`);
  }

  return parts.join(" ");
}

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const body = (await request.json()) as ReinstallPayload;

  if (!body.accountId || !body.instanceId || !body.instanceName) {
    return Response.json({ success: false, message: "缺少 accountId / instanceId / instanceName" }, { status: 400 });
  }
  if (!isSafeHost(body.host)) {
    return Response.json({ success: false, message: "目标主机地址不合法" }, { status: 400 });
  }
  if (!isSafeUsername(body.username)) {
    return Response.json({ success: false, message: "SSH 用户名不合法" }, { status: 400 });
  }
  if (!body.privateKey?.trim()) {
    return Response.json({ success: false, message: "请提供 SSH 私钥" }, { status: 400 });
  }

  const account = await getAccountById(auth.userId, body.accountId);
  if (!account) {
    return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
  }

  const remoteCommand = buildRemoteCommand(body);
  const tempKeyPath = path.join(os.tmpdir(), `oci-panel-dd-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);

  try {
    await fs.writeFile(tempKeyPath, body.privateKey, { mode: 0o600 });

    if (body.dryRun) {
      await appendLog({
        userId: auth.userId,
        ociAccountId: account.id,
        instanceId: body.instanceId,
        account: account.name,
        instance: body.instanceName,
        action: "DD 重装（预检）",
        result: "success",
        message: `已生成远程命令，目标 ${body.host}:${body.port || 22}，镜像 ${body.image || "ubuntu-22.04"}`,
      });

      return Response.json({ success: true, message: "DD 预检通过", commandPreview: remoteCommand });
    }

    const sshArgs = [
      "-i", tempKeyPath,
      "-p", String(body.port || 22),
      "-o", "StrictHostKeyChecking=no",
      "-o", "UserKnownHostsFile=/dev/null",
      "-o", "ConnectTimeout=15",
      `${body.username}@${body.host}`,
      remoteCommand,
    ];

    const result = await execFileAsync("ssh", sshArgs, { timeout: 30_000, maxBuffer: 1024 * 1024 });

    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      instanceId: body.instanceId,
      account: account.name,
      instance: body.instanceName,
      action: "DD 重装",
      result: "success",
      message: `DD 命令已通过 SSH 提交。stdout: ${(result.stdout || "").slice(0, 300) || "(empty)"}`,
    });

    return Response.json({ success: true, message: "DD 命令已提交，请等待实例重装与重启", stdout: result.stdout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DD 执行失败";
    await appendLog({
      userId: auth.userId,
      ociAccountId: account.id,
      instanceId: body.instanceId,
      account: account.name,
      instance: body.instanceName,
      action: "DD 重装",
      result: "failed",
      message,
    });
    return Response.json({ success: false, message }, { status: 500 });
  } finally {
    await fs.rm(tempKeyPath, { force: true }).catch(() => undefined);
  }
}
