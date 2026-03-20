import { requireAuthUser } from "@/lib/auth";
import { listLogs } from "@/lib/logs-store";

export async function GET() {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  return Response.json(await listLogs(auth.userId));
}
