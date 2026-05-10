import { apiFail, apiOk } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth";
import { listLogs } from "@/lib/logs-store";

export async function GET() {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  return apiOk(await listLogs(auth.userId));
}
