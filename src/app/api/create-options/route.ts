import { listAccounts, pickDefaultAccount } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { createComputeClient, createIdentityClient, createVirtualNetworkClient } from "@/lib/oci";

function getTimeValue(input: unknown) {
  if (!input) return 0;
  if (input instanceof Date) return input.getTime();
  if (typeof input === "string" || typeof input === "number") {
    const parsed = new Date(input).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function imageFamily(item: {
  displayName?: string | null;
  operatingSystem?: string | null;
  operatingSystemVersion?: string | null;
}) {
  const text = `${item.displayName || ""} ${item.operatingSystem || ""} ${item.operatingSystemVersion || ""}`.toLowerCase();
  if (/ubuntu/.test(text)) return "ubuntu";
  if (/debian/.test(text)) return "debian";
  if (/oracle linux/.test(text)) return "oracle-linux";
  if (/centos/.test(text)) return "centos";
  if (/rocky/.test(text)) return "rocky";
  if (/alma/.test(text)) return "alma";
  if (/windows/.test(text)) return "windows";
  return "other";
}

function versionRank(item: {
  displayName?: string | null;
  operatingSystemVersion?: string | null;
}) {
  const text = `${item.displayName || ""} ${item.operatingSystemVersion || ""}`.toLowerCase();
  const numbers = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, n, idx) => acc + n / Math.pow(100, idx), 0);
}

function rankImage(item: {
  displayName?: string | null;
  operatingSystem?: string | null;
  operatingSystemVersion?: string | null;
  lifecycleState?: string | null;
  timeCreated?: unknown;
}) {
  const text = `${item.displayName || ""} ${item.operatingSystem || ""} ${item.operatingSystemVersion || ""}`.toLowerCase();
  let score = 0;
  if (item.lifecycleState === "AVAILABLE") score += 1000;
  if (/ubuntu/.test(text)) score += 500;
  else if (/debian/.test(text)) score += 450;
  else if (/oracle linux/.test(text)) score += 400;
  else if (/centos/.test(text)) score += 350;
  else if (/rocky|alma/.test(text)) score += 320;
  else if (/windows/.test(text)) score += 200;
  if (/gpu/.test(text)) score -= 100;
  if (/gen1|legacy|deprecated/.test(text)) score -= 80;
  const createdAt = getTimeValue(item.timeCreated);
  return score * 1_000_000_000_000 + Math.round(versionRank(item) * 1_000_000) + createdAt;
}

export async function GET(request: Request) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  const accounts = await listAccounts(auth.userId);
  const target = accountId ? accounts.find((item) => item.id === accountId) : pickDefaultAccount(accounts);

  if (!target) {
    return Response.json({ success: false, message: "没有可用账户" }, { status: 404 });
  }

  try {
    const identityClient = await createIdentityClient(target);
    const computeClient = await createComputeClient(target);
    const networkClient = await createVirtualNetworkClient(target);

    const adsRes = await identityClient.listAvailabilityDomains({ compartmentId: target.tenancy });
    const availabilityDomains = (adsRes.items || []).map((item) => item.name).filter(Boolean) as string[];
    const ad = availabilityDomains[0];

    const [shapesRes, imagesRes, vcnsRes, subnetsRes] = await Promise.all([
      ad
        ? computeClient.listShapes({ compartmentId: target.tenancy, availabilityDomain: ad })
        : Promise.resolve({ items: [] }),
      computeClient.listImages({ compartmentId: target.tenancy }),
      networkClient.listVcns({ compartmentId: target.tenancy }),
      networkClient.listSubnets({ compartmentId: target.tenancy }),
    ]);

    const familyLimits: Record<string, number> = {
      ubuntu: 4,
      debian: 3,
      "oracle-linux": 4,
      centos: 2,
      rocky: 2,
      alma: 2,
      windows: 3,
      other: 8,
    };
    const familyCounts = new Map<string, number>();

    const images = (imagesRes.items || [])
      .filter((item) => item.id && item.displayName && item.lifecycleState === "AVAILABLE")
      .sort((a, b) => rankImage(b) - rankImage(a))
      .filter((item) => {
        const family = imageFamily(item);
        const next = (familyCounts.get(family) || 0) + 1;
        const limit = familyLimits[family] ?? 3;
        if (next > limit) return false;
        familyCounts.set(family, next);
        return true;
      })
      .map((item) => ({
        id: item.id,
        displayName: item.displayName,
        operatingSystem: item.operatingSystem,
        operatingSystemVersion: item.operatingSystemVersion,
      }));

    return Response.json({
      success: true,
      account: {
        id: target.id,
        name: target.name,
        region: target.region,
      },
      availabilityDomains: availabilityDomains.map((name) => ({ name })),
      shapes: (shapesRes.items || []).slice(0, 80).map((item) => ({
        shape: item.shape,
        processorDescription: item.processorDescription,
        ocpus: item.ocpus,
        memoryInGBs: item.memoryInGBs,
      })),
      images,
      vcns: (vcnsRes.items || []).map((item) => ({
        id: item.id,
        displayName: item.displayName,
        cidrBlock: item.cidrBlock,
        ipv6CidrBlocks: item.ipv6CidrBlocks || [],
      })),
      subnets: (subnetsRes.items || []).map((item) => ({
        id: item.id,
        displayName: item.displayName,
        vcnId: item.vcnId,
        cidrBlock: item.cidrBlock,
        ipv6CidrBlock: item.ipv6CidrBlock,
        prohibitPublicIpOnVnic: item.prohibitPublicIpOnVnic,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载创建实例资源失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
