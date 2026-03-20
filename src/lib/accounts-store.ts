import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export interface StoredOracleAccount {
  id: string;
  userId: string;
  name: string;
  tenancy: string;
  userOcid: string;
  fingerprint: string;
  privateKey?: string;
  keyFilePath?: string;
  region: string;
  passphrase?: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type DbOciAccount = Awaited<ReturnType<typeof prisma.ociAccount.findFirst>> extends infer T
  ? NonNullable<T>
  : never;

function mapDbAccount(account: DbOciAccount): StoredOracleAccount {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    tenancy: account.tenancy,
    userOcid: account.userOcid,
    fingerprint: account.fingerprint,
    privateKey: decrypt(account.privateKeyEncrypted),
    keyFilePath: account.keyFilePath || "",
    region: account.region,
    passphrase: account.passphraseEncrypted ? decrypt(account.passphraseEncrypted) : "",
    description: account.description || "",
    isDefault: account.isDefault,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function listAccounts(userId: string): Promise<StoredOracleAccount[]> {
  const accounts = await prisma.ociAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return accounts.map(mapDbAccount);
}

export function pickDefaultAccount(accounts: StoredOracleAccount[]): StoredOracleAccount | undefined {
  return accounts.find((item) => item.isDefault) ?? accounts[0];
}

export async function createAccount(
  userId: string,
  input: Omit<StoredOracleAccount, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<StoredOracleAccount> {
  const existing = await prisma.ociAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const shouldBeDefault = input.isDefault || existing.length === 0;

  const created = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.ociAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.ociAccount.create({
      data: {
        userId,
        name: input.name,
        tenancy: input.tenancy,
        userOcid: input.userOcid,
        fingerprint: input.fingerprint,
        privateKeyEncrypted: encrypt(input.privateKey || ""),
        keyFilePath: input.keyFilePath || null,
        region: input.region,
        passphraseEncrypted: input.passphrase ? encrypt(input.passphrase) : null,
        description: input.description || null,
        isDefault: shouldBeDefault,
        isActive: input.isActive,
      },
    });
  });

  return mapDbAccount(created);
}



export async function updateAccount(
  userId: string,
  accountId: string,
  input: Omit<StoredOracleAccount, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<StoredOracleAccount> {
  const target = await prisma.ociAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!target) {
    throw new Error("账户不存在");
  }

  const shouldBeDefault = Boolean(input.isDefault);

  await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.ociAccount.updateMany({
        where: { userId, isDefault: true, NOT: { id: accountId } },
        data: { isDefault: false },
      });
    }

    await tx.ociAccount.update({
      where: { id: accountId },
      data: {
        name: input.name,
        tenancy: input.tenancy,
        userOcid: input.userOcid,
        fingerprint: input.fingerprint,
        privateKeyEncrypted: encrypt(input.privateKey || ""),
        keyFilePath: input.keyFilePath || null,
        region: input.region,
        passphraseEncrypted: input.passphrase ? encrypt(input.passphrase) : null,
        description: input.description || null,
        isDefault: shouldBeDefault,
        isActive: input.isActive,
      },
    });
  });

  const updated = await prisma.ociAccount.findUniqueOrThrow({ where: { id: accountId } });
  return mapDbAccount(updated);
}

export async function setAccountActiveState(userId: string, accountId: string, isActive: boolean): Promise<StoredOracleAccount> {
  const target = await prisma.ociAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!target) {
    throw new Error("账户不存在");
  }

  if (!isActive && target.isDefault) {
    const fallback = await prisma.ociAccount.findFirst({
      where: { userId, id: { not: accountId } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (!fallback) {
      throw new Error("默认账户不能直接停用，请先新增或切换到其他账户");
    }

    await prisma.$transaction(async (tx) => {
      await tx.ociAccount.update({ where: { id: accountId }, data: { isActive: false, isDefault: false } });
      await tx.ociAccount.update({ where: { id: fallback.id }, data: { isDefault: true } });
    });
  } else {
    await prisma.ociAccount.update({
      where: { id: accountId },
      data: { isActive },
    });
  }

  const updated = await prisma.ociAccount.findUniqueOrThrow({ where: { id: accountId } });
  return mapDbAccount(updated);
}

export async function setDefaultAccount(userId: string, accountId: string): Promise<StoredOracleAccount> {
  const target = await prisma.ociAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!target) {
    throw new Error("账户不存在");
  }

  await prisma.$transaction(async (tx) => {
    await tx.ociAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    await tx.ociAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });
  });

  const updated = await prisma.ociAccount.findUniqueOrThrow({ where: { id: accountId } });
  return mapDbAccount(updated);
}

export async function getAccountById(userId: string, accountId: string): Promise<StoredOracleAccount | null> {
  const account = await prisma.ociAccount.findFirst({
    where: { id: accountId, userId },
  });

  return account ? mapDbAccount(account) : null;
}

export async function deleteAccount(userId: string, accountId: string): Promise<{ deletedId: string; nextDefaultAccountId?: string }> {
  const target = await prisma.ociAccount.findFirst({
    where: { id: accountId, userId },
    orderBy: { createdAt: "asc" },
  });

  if (!target) {
    throw new Error("账户不存在");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.ociAccount.delete({
      where: { id: accountId },
    });

    let nextDefaultAccountId: string | undefined;

    if (target.isDefault) {
      const nextAccount = await tx.ociAccount.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "asc" }],
      });

      if (nextAccount) {
        await tx.ociAccount.update({
          where: { id: nextAccount.id },
          data: { isDefault: true },
        });
        nextDefaultAccountId = nextAccount.id;
      }
    }

    return { deletedId: accountId, nextDefaultAccountId };
  });

  return result;
}
