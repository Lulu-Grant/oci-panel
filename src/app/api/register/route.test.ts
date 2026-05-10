import { beforeEach, describe, expect, it, vi } from "vitest";

const registrationPolicy = vi.hoisted(() => ({
  enabled: true,
}));

const prismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/registration", () => ({
  isPublicRegistrationEnabled: vi.fn(() => registrationPolicy.enabled),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: prismaUser,
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (value: string) => `hash:${value}`),
  },
}));

describe("/api/register", () => {
  beforeEach(() => {
    registrationPolicy.enabled = true;
    vi.clearAllMocks();
  });

  it("rejects registration when public registration is disabled", async () => {
    registrationPolicy.enabled = false;
    const { POST } = await import("@/app/api/register/route");

    const response = await POST(new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", password: "secret123" }),
    }));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toEqual({ success: false, message: "公开注册已关闭，请联系管理员创建账户" });
    expect(prismaUser.create).not.toHaveBeenCalled();
  });

  it("normalizes email and creates a password user when enabled", async () => {
    prismaUser.findUnique.mockResolvedValue(null);
    prismaUser.create.mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: "New User",
    });
    const { POST } = await import("@/app/api/register/route");

    const response = await POST(new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: " New User ", email: " NEW@EXAMPLE.COM ", password: "secret123" }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(prismaUser.findUnique).toHaveBeenCalledWith({ where: { email: "new@example.com" } });
    expect(prismaUser.create).toHaveBeenCalledWith({
      data: {
        name: "New User",
        email: "new@example.com",
        passwordHash: "hash:secret123",
      },
    });
    expect(json).toEqual({
      success: true,
      data: {
        user: { id: "user-1", email: "new@example.com", name: "New User" },
      },
    });
  });

  it("rejects duplicate email addresses", async () => {
    prismaUser.findUnique.mockResolvedValue({ id: "existing-user" });
    const { POST } = await import("@/app/api/register/route");

    const response = await POST(new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "existing@example.com", password: "secret123" }),
    }));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ success: false, message: "该邮箱已注册" });
    expect(prismaUser.create).not.toHaveBeenCalled();
  });
});

