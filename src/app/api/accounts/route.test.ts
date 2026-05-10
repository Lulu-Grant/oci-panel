import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  userId: "user-1",
}));

const accountsStore = vi.hoisted(() => ({
  createAccount: vi.fn(),
  deleteAccount: vi.fn(),
  getAccountById: vi.fn(),
  listAccounts: vi.fn(),
  setAccountActiveState: vi.fn(),
  setDefaultAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

const logsStore = vi.hoisted(() => ({
  appendLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuthUser: vi.fn(async () => ({ userId: authState.userId })),
}));

vi.mock("@/lib/accounts-store", () => accountsStore);
vi.mock("@/lib/logs-store", () => logsStore);

function account(overrides = {}) {
  return {
    id: "account-1",
    userId: "user-1",
    name: "Primary",
    tenancy: "tenancy-1",
    userOcid: "user-ocid-1",
    fingerprint: "fingerprint-1",
    privateKey: "secret-private-key",
    keyFilePath: "",
    region: "ap-singapore-1",
    passphrase: "secret-passphrase",
    description: "",
    isDefault: true,
    isActive: true,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("/api/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe account detail metadata without decrypted credentials", async () => {
    accountsStore.getAccountById.mockResolvedValue(account());
    const { GET } = await import("@/app/api/accounts/route");

    const response = await GET(new Request("http://localhost/api/accounts?accountId=account-1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        id: "account-1",
        hasPrivateKey: true,
        hasPassphrase: true,
      },
    });
    expect(json.data).not.toHaveProperty("privateKey");
    expect(json.data).not.toHaveProperty("passphrase");
  });

  it("does not forward credential fields on metadata-only account updates", async () => {
    accountsStore.updateAccount.mockResolvedValue(account({ name: "Renamed" }));
    const { PATCH } = await import("@/app/api/accounts/route");

    const response = await PATCH(new Request("http://localhost/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: "account-1",
        action: "update",
        name: "Renamed",
        tenancy: "tenancy-1",
        userOcid: "user-ocid-1",
        fingerprint: "fingerprint-1",
        region: "ap-singapore-1",
        isDefault: true,
        isActive: true,
        replaceCredential: false,
        privateKey: "should-not-forward",
        passphrase: "should-not-forward",
      }),
    }));

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, data: { accountId: "account-1" } });
    expect(accountsStore.updateAccount).toHaveBeenCalledWith("user-1", "account-1", expect.objectContaining({
      replaceCredential: false,
      privateKey: undefined,
      passphrase: undefined,
    }));
  });
});

