import { getAccountById } from "@/lib/accounts-store";
import { requireAuthUser } from "@/lib/auth";
import { createBlockstorageClient, createComputeClient, createVirtualNetworkClient } from "@/lib/oci";
import { InstanceDetailItem } from "@/types/dashboard";

export async function GET(
  request: Request,
  context: { params: Promise<{ instanceId: string }> }
) {
  const auth = await requireAuthUser();
  if (!auth) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const { instanceId } = await context.params;

  if (!accountId) {
    return Response.json({ success: false, message: "缺少 accountId" }, { status: 400 });
  }

  if (!instanceId) {
    return Response.json({ success: false, message: "缺少 instanceId" }, { status: 400 });
  }

  const account = await getAccountById(auth.userId, accountId);

  if (!account) {
    return Response.json({ success: false, message: "账户不存在" }, { status: 404 });
  }

  try {
    const computeClient = await createComputeClient(account);
    const networkClient = await createVirtualNetworkClient(account);
    const blockstorageClient = await createBlockstorageClient(account);
    const response = await computeClient.getInstance({ instanceId });
    const instance = response.instance;

    const [networking, bootVolume, imageInfo, shapeInfo] = await Promise.all([
      getInstanceNetworking(computeClient, networkClient, account.tenancy, instanceId),
      getBootVolume(computeClient, blockstorageClient, account.tenancy, instance.availabilityDomain || "", instanceId),
      getImageInfo(computeClient, instance.imageId),
      getShapeInfo(computeClient, account.tenancy, instance.availabilityDomain || "", instance.shape),
    ]);

    const detail: InstanceDetailItem = {
      id: instance.id || instanceId,
      accountId: account.id,
      accountName: account.name,
      region: account.region,
      name: instance.displayName || "Unnamed instance",
      status: mapLifecycleState(instance.lifecycleState),
      lifecycleStateRaw: instance.lifecycleState || "UNKNOWN",
      ip: networking.publicIp || networking.privateIp || "-",
      ipv6: networking.ipv6 || "-",
      shape: instance.shape || "-",
      availabilityDomain: instance.availabilityDomain || "-",
      faultDomain: instance.faultDomain || "-",
      compartmentId: instance.compartmentId || account.tenancy,
      imageId: instance.imageId || "-",
      subnetId: networking.subnetId || "-",
      vcnId: networking.vcnId || "-",
      subnetName: networking.subnetName || "-",
      vcnName: networking.vcnName || "-",
      ocpus: instance.shapeConfig?.ocpus,
      memoryInGBs: instance.shapeConfig?.memoryInGBs,
      timeCreated: instance.timeCreated ? new Date(instance.timeCreated).toISOString() : undefined,
      vnicId: networking.vnicId || "-",
      privateIp: networking.privateIp || "-",
      publicIp: networking.publicIp || "-",
      nsgIds: networking.nsgIds || [],
      bootVolumeId: bootVolume.id || "-",
      bootVolumeName: bootVolume.name || "-",
      bootVolumeSizeInGBs: bootVolume.sizeInGBs,
      imageDisplayName: imageInfo.displayName,
      imageOperatingSystem: imageInfo.operatingSystem,
      imageOperatingSystemVersion: imageInfo.operatingSystemVersion,
      shapeProcessorDescription: shapeInfo.processorDescription,
      shapeOcpusOptions: shapeInfo.ocpusOptions,
      shapeMemoryOptions: shapeInfo.memoryOptions,
      subnetCidrBlock: networking.subnetCidrBlock || "-",
      subnetIpv6CidrBlock: networking.subnetIpv6CidrBlock || "-",
      subnetProhibitPublicIpOnVnic: networking.subnetProhibitPublicIpOnVnic,
      vcnCidrBlock: networking.vcnCidrBlock || "-",
      vcnIpv6CidrBlocks: networking.vcnIpv6CidrBlocks || [],
    };

    return Response.json({ success: true, detail });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "加载实例详情失败" },
      { status: 500 }
    );
  }
}

async function getInstanceNetworking(
  computeClient: Awaited<ReturnType<typeof createComputeClient>>,
  networkClient: Awaited<ReturnType<typeof createVirtualNetworkClient>>,
  compartmentId: string,
  instanceId: string
) {
  try {
    const vnicAttachments = await computeClient.listVnicAttachments({ compartmentId, instanceId });
    const attachment = (vnicAttachments.items || [])[0];
    if (!attachment?.vnicId) {
      return {
        vnicId: "-",
        privateIp: "-",
        publicIp: "-",
        ipv6: "-",
        subnetId: "-",
        vcnId: "-",
        subnetName: "-",
        vcnName: "-",
        subnetCidrBlock: "-",
        subnetIpv6CidrBlock: "-",
        subnetProhibitPublicIpOnVnic: undefined,
        vcnCidrBlock: "-",
        vcnIpv6CidrBlocks: [],
        nsgIds: [],
      };
    }

    const vnic = await networkClient.getVnic({ vnicId: attachment.vnicId });
    const vnicData = vnic.vnic as {
      subnetId?: string;
      vcnId?: string;
      privateIp?: string;
      publicIp?: string;
      nsgIds?: string[];
    };

    const subnetId = vnicData.subnetId || "-";
    const vcnId = vnicData.vcnId || "-";

    const [subnetRes, vcnRes] = await Promise.all([
      subnetId && subnetId !== "-" ? networkClient.getSubnet({ subnetId }) : Promise.resolve(null),
      vcnId && vcnId !== "-" ? networkClient.getVcn({ vcnId }) : Promise.resolve(null),
    ]);

    let ipv6 = "-";
    try {
      const ipv6s = await networkClient.listIpv6s({ vnicId: attachment.vnicId });
      const firstIpv6 = (ipv6s.items || [])[0];
      if (firstIpv6?.ipAddress) ipv6 = firstIpv6.ipAddress;
    } catch {
      ipv6 = "-";
    }

    return {
      vnicId: attachment.vnicId,
      privateIp: vnicData.privateIp || "-",
      publicIp: vnicData.publicIp || "-",
      ipv6,
      subnetId,
      vcnId,
      subnetName: subnetRes?.subnet?.displayName || "-",
      vcnName: vcnRes?.vcn?.displayName || "-",
      subnetCidrBlock: subnetRes?.subnet?.cidrBlock || "-",
      subnetIpv6CidrBlock: subnetRes?.subnet?.ipv6CidrBlock || "-",
      subnetProhibitPublicIpOnVnic: subnetRes?.subnet?.prohibitPublicIpOnVnic,
      vcnCidrBlock: vcnRes?.vcn?.cidrBlock || "-",
      vcnIpv6CidrBlocks: vcnRes?.vcn?.ipv6CidrBlocks || [],
      nsgIds: vnicData.nsgIds || [],
    };
  } catch {
    return {
      vnicId: "-",
      privateIp: "-",
      publicIp: "-",
      ipv6: "-",
      subnetId: "-",
      vcnId: "-",
      subnetName: "-",
      vcnName: "-",
      subnetCidrBlock: "-",
      subnetIpv6CidrBlock: "-",
      subnetProhibitPublicIpOnVnic: undefined,
      vcnCidrBlock: "-",
      vcnIpv6CidrBlocks: [],
      nsgIds: [],
    };
  }
}

async function getBootVolume(
  computeClient: Awaited<ReturnType<typeof createComputeClient>>,
  blockstorageClient: Awaited<ReturnType<typeof createBlockstorageClient>>,
  compartmentId: string,
  availabilityDomain: string,
  instanceId: string
) {
  if (!availabilityDomain) {
    return { id: "-", name: "-", sizeInGBs: undefined as number | undefined };
  }

  try {
    const attachments = await computeClient.listBootVolumeAttachments({ compartmentId, availabilityDomain, instanceId });
    const attachment = (attachments.items || [])[0];
    if (!attachment?.bootVolumeId) {
      return { id: "-", name: "-", sizeInGBs: undefined as number | undefined };
    }

    const volume = await blockstorageClient.getBootVolume({ bootVolumeId: attachment.bootVolumeId });
    return {
      id: volume.bootVolume.id || attachment.bootVolumeId,
      name: volume.bootVolume.displayName || "-",
      sizeInGBs: volume.bootVolume.sizeInGBs,
    };
  } catch {
    return { id: "-", name: "-", sizeInGBs: undefined as number | undefined };
  }
}

async function getImageInfo(
  computeClient: Awaited<ReturnType<typeof createComputeClient>>,
  imageId?: string | null
) {
  if (!imageId) {
    return { displayName: "-", operatingSystem: "-", operatingSystemVersion: "-" };
  }

  try {
    const response = await computeClient.getImage({ imageId });
    return {
      displayName: response.image.displayName || "-",
      operatingSystem: response.image.operatingSystem || "-",
      operatingSystemVersion: response.image.operatingSystemVersion || "-",
    };
  } catch {
    return { displayName: "-", operatingSystem: "-", operatingSystemVersion: "-" };
  }
}

async function getShapeInfo(
  computeClient: Awaited<ReturnType<typeof createComputeClient>>,
  compartmentId: string,
  availabilityDomain: string,
  shapeName?: string | null
) {
  if (!availabilityDomain || !shapeName) {
    return { processorDescription: "-", ocpusOptions: "-", memoryOptions: "-" };
  }

  try {
    const response = await computeClient.listShapes({ compartmentId, availabilityDomain });
    const matched = (response.items || []).find((item) => item.shape === shapeName);
    if (!matched) {
      return { processorDescription: "-", ocpusOptions: "-", memoryOptions: "-" };
    }

    const ocpusOptions = matched.ocpuOptions
      ? `${matched.ocpuOptions.min ?? "-"} ~ ${matched.ocpuOptions.max ?? "-"}`
      : "-";
    const memoryOptions = matched.memoryOptions
      ? `${matched.memoryOptions.minInGBs ?? "-"} ~ ${matched.memoryOptions.maxInGBs ?? "-"} GB`
      : "-";

    return {
      processorDescription: matched.processorDescription || "-",
      ocpusOptions,
      memoryOptions,
    };
  } catch {
    return { processorDescription: "-", ocpusOptions: "-", memoryOptions: "-" };
  }
}

function mapLifecycleState(state?: string | null) {
  switch (state) {
    case "RUNNING":
      return "running";
    case "STOPPED":
      return "stopped";
    case "STARTING":
      return "starting";
    case "STOPPING":
      return "stopping";
    default:
      return "error";
  }
}
