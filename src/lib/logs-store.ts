import { prisma } from "@/lib/prisma";
import { LogItem } from "@/types/dashboard";

export interface AppendLogInput {
  userId: string;
  ociAccountId?: string | null;
  time?: string;
  user?: string;
  account: string;
  instance: string;
  instanceId?: string | null;
  action: string;
  result: "success" | "failed";
  message: string;
}

function mapDbLog(log: {
  id: string;
  createdAt: Date;
  userId: string;
  action: string;
  result: string;
  message: string;
  instanceName: string | null;
  ociAccount?: { name: string } | null;
}): LogItem {
  return {
    id: log.id,
    time: log.createdAt.toISOString(),
    user: log.userId,
    account: log.ociAccount?.name || "-",
    instance: log.instanceName || "-",
    action: log.action,
    result: log.result === "success" ? "success" : "failed",
    message: log.message,
  };
}

export async function listLogs(userId: string): Promise<LogItem[]> {
  const logs = await prisma.operationLog.findMany({
    where: { userId },
    include: {
      ociAccount: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return logs.map(mapDbLog);
}

export async function appendLog(log: AppendLogInput): Promise<LogItem> {
  const createdAt = log.time ? new Date(log.time) : new Date();

  const created = await prisma.operationLog.create({
    data: {
      userId: log.userId,
      ociAccountId: log.ociAccountId || null,
      instanceId: log.instanceId || null,
      instanceName: log.instance,
      action: log.action,
      result: log.result,
      message: log.message,
      createdAt,
    },
    include: {
      ociAccount: {
        select: { name: true },
      },
    },
  });

  return mapDbLog(created);
}
