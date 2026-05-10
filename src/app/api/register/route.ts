import bcrypt from "bcryptjs";
import { apiFail, apiOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return apiFail("缺少邮箱或密码", 400);
  }

  if (password.length < 6) {
    return apiFail("密码至少 6 位", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return apiFail("该邮箱已注册", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: name || null,
      email,
      passwordHash,
    },
  });

  return apiOk({ user: { id: user.id, email: user.email, name: user.name } });
}
