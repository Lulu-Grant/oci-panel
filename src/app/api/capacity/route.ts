import { listAccounts, pickDefaultAccount } from "@/lib/accounts-store";
import { apiFail, apiOk } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth";
import { createIdentityClient, createLimitsClient } from "@/lib/oci";

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return apiFail("未登录", 401);
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  const accounts = await listAccounts(auth.userId);
  const target = accountId ? accounts.find((item) => item.id === accountId) : pickDefaultAccount(accounts);

  if (!target) {
    return apiFail("没有可用账户", 404);
  }
  if (!target.isActive) {
    return apiFail("账户已停用，请先启用后再查询额度", 409);
  }

  try {
    const identityClient = await createIdentityClient(target);
    const limitsClient = await createLimitsClient(target);

    const [regionsRes, adsRes, servicesRes] = await Promise.all([
      identityClient.listRegionSubscriptions({ tenancyId: target.tenancy }),
      identityClient.listAvailabilityDomains({ compartmentId: target.tenancy }),
      limitsClient.listServices({ compartmentId: target.tenancy }),
    ]);

    const shapeService = (servicesRes.items || []).find((item) => item.name?.toLowerCase().includes("compute"));
    let limitValues: unknown[] = [];

    if (shapeService?.name) {
      try {
        const limitsRes = await limitsClient.listLimitValues({
          compartmentId: target.tenancy,
          serviceName: shapeService.name,
        });
        limitValues = limitsRes.items || [];
      } catch {
        limitValues = [];
      }
    }

    return apiOk({
      account: {
        id: target.id,
        name: target.name,
        region: target.region,
      },
      regions: (regionsRes.items || []).map((item) => ({
        regionName: item.regionName,
        regionKey: item.regionKey,
        status: item.status,
      })),
      availabilityDomains: (adsRes.items || []).map((item) => ({
        name: item.name,
      })),
      services: (servicesRes.items || []).map((item) => ({
        name: item.name,
        description: item.description,
      })),
      limitValues,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询额度失败";
    return apiFail(message, 500);
  }
}
