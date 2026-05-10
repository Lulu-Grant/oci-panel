import { beforeEach, describe, expect, it, vi } from "vitest";

type MockDbAccount = {
  id: string;
  userId: string;
  name: string;
  tenancy: string;
  userOcid: string;
  fingerprint: string;
  privateKeyEncrypted: string;
  keyFilePath: string | null;
  region: string;
  passphraseEncrypted: string | null;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const state = vi.hoisted(() => ({
  accounts: [] as MockDbAccount[],
}));

const mockOciAccount = vi.hoisted(() => {
  function matchesWhere(account: MockDbAccount, where?: Record<string, unknown>) {
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => {
      if (key === "NOT" && value && typeof value === "object") {
        return !matchesWhere(account, value as Record<string, unknown>);
      }
      if (key === "id" && value && typeof value === "object" && "not" in value) {
        return account.id !== (value as { not: string }).not;
      }
      return account[key as keyof MockDbAccount] === value;
    });
  }

  function sortAccounts(accounts: MockDbAccount[], orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">) {
    const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    return [...accounts].sort((a, b) => {
      for (const clause of clauses) {
        const [field, direction] = Object.entries(clause)[0] as [keyof MockDbAccount, "asc" | "desc"];
        const left = a[field];
        const right = b[field];
        const comparison = left instanceof Date && right instanceof Date
          ? left.getTime() - right.getTime()
          : Number(left > right) - Number(left < right);
        if (comparison !== 0) return direction === "asc" ? comparison : -comparison;
      }
      return 0;
    });
  }

  const api = {
    findMany: vi.fn(async ({ where, orderBy }: { where?: Record<string, unknown>; orderBy?: Array<Record<string, "asc" | "desc">> }) => {
      return sortAccounts(state.accounts.filter((account) => matchesWhere(account, where)), orderBy);
    }),
    findFirst: vi.fn(async ({ where, orderBy }: { where?: Record<string, unknown>; orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc"> }) => {
      return sortAccounts(state.accounts.filter((account) => matchesWhere(account, where)), orderBy)[0] ?? null;
    }),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
      const account = state.accounts.find((item) => item.id === where.id);
      if (!account) throw new Error("not found");
      return account;
    }),
    updateMany: vi.fn(async ({ where, data }: { where?: Record<string, unknown>; data: Partial<MockDbAccount> }) => {
      let count = 0;
      state.accounts = state.accounts.map((account) => {
        if (!matchesWhere(account, where)) return account;
        count += 1;
        return { ...account, ...data, updatedAt: new Date("2026-05-10T01:00:00.000Z") };
      });
      return { count };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockDbAccount> }) => {
      const index = state.accounts.findIndex((account) => account.id === where.id);
      if (index === -1) throw new Error("not found");
      state.accounts[index] = { ...state.accounts[index], ...data, updatedAt: new Date("2026-05-10T01:00:00.000Z") };
      return state.accounts[index];
    }),
    create: vi.fn(),
    delete: vi.fn(),
  };

  return api;
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ociAccount: mockOciAccount,
    $transaction: vi.fn(async (callback) => callback({ ociAccount: mockOciAccount })),
  },
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
}));

function makeAccount(overrides: Partial<MockDbAccount>): MockDbAccount {
  return {
    id: "account-1",
    userId: "user-1",
    name: "Primary",
    tenancy: "tenancy-1",
    userOcid: "user-ocid-1",
    fingerprint: "fingerprint-1",
    privateKeyEncrypted: "enc:original-private-key",
    keyFilePath: null,
    region: "ap-singapore-1",
    passphraseEncrypted: "enc:original-passphrase",
    description: null,
    isDefault: false,
    isActive: true,
    createdAt: new Date("2026-05-10T00:00:00.000Z"),
    updatedAt: new Date("2026-05-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("accounts-store", () => {
  beforeEach(() => {
    state.accounts = [];
    vi.clearAllMocks();
  });

  it("preserves encrypted credentials when account metadata changes without replacement", async () => {
    state.accounts = [makeAccount({ id: "account-1", isDefault: true })];
    const { updateAccount } = await import("@/lib/accounts-store");

    const updated = await updateAccount("user-1", "account-1", {
      name: "Renamed",
      tenancy: "tenancy-2",
      userOcid: "user-ocid-2",
      fingerprint: "fingerprint-2",
      keyFilePath: "",
      region: "us-ashburn-1",
      description: "metadata only",
      isDefault: true,
      isActive: true,
      replaceCredential: false,
    });

    expect(state.accounts[0].privateKeyEncrypted).toBe("enc:original-private-key");
    expect(state.accounts[0].passphraseEncrypted).toBe("enc:original-passphrase");
    expect(updated.privateKey).toBe("original-private-key");
    expect(updated.passphrase).toBe("original-passphrase");
    expect(updated.name).toBe("Renamed");
  });

  it("replaces encrypted credentials only when explicitly requested", async () => {
    state.accounts = [makeAccount({ id: "account-1" })];
    const { updateAccount } = await import("@/lib/accounts-store");

    const updated = await updateAccount("user-1", "account-1", {
      name: "Primary",
      tenancy: "tenancy-1",
      userOcid: "user-ocid-1",
      fingerprint: "fingerprint-1",
      keyFilePath: "",
      region: "ap-singapore-1",
      description: "",
      isDefault: false,
      isActive: true,
      replaceCredential: true,
      privateKey: "new-private-key",
      passphrase: "new-passphrase",
    });

    expect(state.accounts[0].privateKeyEncrypted).toBe("enc:new-private-key");
    expect(state.accounts[0].passphraseEncrypted).toBe("enc:new-passphrase");
    expect(updated.privateKey).toBe("new-private-key");
    expect(updated.passphrase).toBe("new-passphrase");
  });

  it("does not pick disabled default accounts", async () => {
    const { pickDefaultAccount } = await import("@/lib/accounts-store");

    const picked = pickDefaultAccount([
      makeAccount({ id: "disabled-default", isDefault: true, isActive: false }),
      makeAccount({ id: "active-fallback", isDefault: false, isActive: true }),
    ]);

    expect(picked?.id).toBe("active-fallback");
  });

  it("rejects setting a disabled account as default", async () => {
    state.accounts = [makeAccount({ id: "disabled", isActive: false })];
    const { setDefaultAccount } = await import("@/lib/accounts-store");

    await expect(setDefaultAccount("user-1", "disabled")).rejects.toThrow("停用账户不能设为默认账户");
  });

  it("moves default status to an active fallback when disabling the default account", async () => {
    state.accounts = [
      makeAccount({ id: "default", isDefault: true, isActive: true, createdAt: new Date("2026-05-10T00:00:00.000Z") }),
      makeAccount({ id: "fallback", isDefault: false, isActive: true, createdAt: new Date("2026-05-10T00:01:00.000Z") }),
    ];
    const { setAccountActiveState } = await import("@/lib/accounts-store");

    await setAccountActiveState("user-1", "default", false);

    expect(state.accounts.find((account) => account.id === "default")).toMatchObject({ isDefault: false, isActive: false });
    expect(state.accounts.find((account) => account.id === "fallback")).toMatchObject({ isDefault: true, isActive: true });
  });
});

