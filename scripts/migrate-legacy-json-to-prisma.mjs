#!/usr/bin/env node
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const sqlitePath = databaseUrl.startsWith("file:") ? databaseUrl.replace(/^file:/, "") : databaseUrl;
const adapter = new PrismaBetterSqlite3({
  url: sqlitePath,
});
const prisma = new PrismaClient({ adapter });

const workspaceRoot = process.cwd();
const dataDir = path.join(workspaceRoot, "data");
const legacyAccountsPath = path.join(dataDir, "oracle-accounts.json");
const legacyLogsPath = path.join(dataDir, "operation-logs.json");
const archiveDir = path.join(dataDir, "archive");

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.APP_ENCRYPTION_KEY || "dev-only-openclaw-oci-panel-key-32b";
const KEY = crypto.createHash("sha256").update(SECRET).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function parseArgs(argv) {
  const args = { archive: false };

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === "--email") args.email = argv[i + 1];
    if (part === "--user-id") args.userId = argv[i + 1];
    if (part === "--archive") args.archive = true;
  }

  return args;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  if (!(await exists(filePath))) return fallback;
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function archiveFile(filePath) {
  if (!(await exists(filePath))) return null;
  await fs.mkdir(archiveDir, { recursive: true });
  const target = path.join(archiveDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${path.basename(filePath)}`);
  await fs.rename(filePath, target);
  return target;
}

async function resolveUser(args) {
  if (args.userId) {
    const user = await prisma.user.findUnique({ where: { id: args.userId } });
    if (!user) throw new Error(`未找到 userId=${args.userId} 对应的平台用户`);
    return user;
  }

  if (args.email) {
    const user = await prisma.user.findUnique({ where: { email: args.email } });
    if (!user) throw new Error(`未找到 email=${args.email} 对应的平台用户`);
    return user;
  }

  throw new Error("请提供 --email <邮箱> 或 --user-id <用户ID>");
}

async function migrateAccounts(userId, legacyAccounts) {
  let imported = 0;
  let skipped = 0;

  const existingCount = await prisma.ociAccount.count({ where: { userId } });
  if (existingCount > 0) {
    return { imported, skipped: legacyAccounts.length, note: "目标用户已有 OCI 账户，已跳过账户导入" };
  }

  for (let index = 0; index < legacyAccounts.length; index += 1) {
    const account = legacyAccounts[index];
    await prisma.ociAccount.create({
      data: {
        userId,
        name: account.name,
        tenancy: account.tenancy,
        userOcid: account.userOcid,
        fingerprint: account.fingerprint,
        privateKeyEncrypted: encrypt(account.privateKey || ""),
        keyFilePath: account.keyFilePath || null,
        region: account.region,
        passphraseEncrypted: account.passphrase ? encrypt(account.passphrase) : null,
        description: account.description || null,
        isDefault: account.isDefault || index === 0,
        isActive: account.isActive ?? true,
        createdAt: account.createdAt ? new Date(account.createdAt) : new Date(),
        updatedAt: account.updatedAt ? new Date(account.updatedAt) : new Date(),
      },
    });
    imported += 1;
  }

  return { imported, skipped, note: null };
}

async function migrateLogs(userId, legacyLogs) {
  let imported = 0;
  let skipped = 0;

  const existingCount = await prisma.operationLog.count({ where: { userId } });
  if (existingCount > 0) {
    return { imported, skipped: legacyLogs.length, note: "目标用户已有操作日志，已跳过日志导入" };
  }

  for (const log of legacyLogs) {
    const account = log.account && log.account !== "-"
      ? await prisma.ociAccount.findFirst({ where: { userId, name: log.account }, select: { id: true } })
      : null;

    await prisma.operationLog.create({
      data: {
        userId,
        ociAccountId: account?.id || null,
        instanceName: log.instance || "-",
        action: log.action,
        result: log.result,
        message: log.message,
        createdAt: log.time ? new Date(log.time) : new Date(),
      },
    });
    imported += 1;
  }

  return { imported, skipped, note: null };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const user = await resolveUser(args);

  const legacyAccountsJson = await readJson(legacyAccountsPath, { accounts: [] });
  const legacyLogsJson = await readJson(legacyLogsPath, { logs: [] });
  const legacyAccounts = Array.isArray(legacyAccountsJson.accounts) ? legacyAccountsJson.accounts : [];
  const legacyLogs = Array.isArray(legacyLogsJson.logs) ? legacyLogsJson.logs : [];

  console.log(`目标用户: ${user.email} (${user.id})`);
  console.log(`发现 legacy 账户: ${legacyAccounts.length}`);
  console.log(`发现 legacy 日志: ${legacyLogs.length}`);

  const accountResult = await migrateAccounts(user.id, legacyAccounts);
  const logResult = await migrateLogs(user.id, legacyLogs);

  console.log("\n迁移结果:");
  console.log(`- 账户导入: ${accountResult.imported}`);
  console.log(`- 账户跳过: ${accountResult.skipped}`);
  if (accountResult.note) console.log(`  说明: ${accountResult.note}`);
  console.log(`- 日志导入: ${logResult.imported}`);
  console.log(`- 日志跳过: ${logResult.skipped}`);
  if (logResult.note) console.log(`  说明: ${logResult.note}`);

  if (args.archive) {
    const archivedAccounts = await archiveFile(legacyAccountsPath);
    const archivedLogs = await archiveFile(legacyLogsPath);
    console.log("\n归档结果:");
    console.log(`- accounts: ${archivedAccounts || "无旧文件"}`);
    console.log(`- logs: ${archivedLogs || "无旧文件"}`);
  } else {
    console.log("\n未执行归档。若确认迁移完成，可追加 --archive 归档旧 JSON 文件。");
  }
}

main()
  .catch((error) => {
    console.error(`迁移失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
