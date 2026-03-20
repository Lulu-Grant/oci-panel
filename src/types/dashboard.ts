export type AccountStatus = "healthy" | "warning" | "error";
export type InstanceStatus = "running" | "stopped" | "starting" | "stopping" | "error";

export interface AccountItem {
  id: string;
  name: string;
  tenancy: string;
  region: string;
  status: AccountStatus;
  instanceCount: number;
  runningCount?: number;
  stoppedCount?: number;
  lastSync: string;
  isDefault?: boolean;
}

export interface InstanceItem {
  id: string;
  name: string;
  accountId?: string;
  accountName: string;
  region: string;
  status: InstanceStatus;
  ip: string;
  ipv6: string;
  shape: string;
  hasPublicIp?: boolean;
  isDualStack?: boolean;
  isFlexShape?: boolean;
  riskFlags?: string[];
}

export interface InstanceDetailItem extends InstanceItem {
  availabilityDomain: string;
  faultDomain: string;
  compartmentId: string;
  imageId: string;
  subnetId: string;
  vcnId: string;
  subnetName?: string;
  vcnName?: string;
  lifecycleStateRaw: string;
  ocpus?: number;
  memoryInGBs?: number;
  timeCreated?: string;
  vnicId?: string;
  privateIp?: string;
  publicIp?: string;
  nsgIds?: string[];
  bootVolumeId?: string;
  bootVolumeName?: string;
  bootVolumeSizeInGBs?: number;
  imageDisplayName?: string;
  imageOperatingSystem?: string;
  imageOperatingSystemVersion?: string;
  shapeProcessorDescription?: string;
  shapeOcpusOptions?: string;
  shapeMemoryOptions?: string;
  subnetCidrBlock?: string;
  subnetIpv6CidrBlock?: string;
  subnetProhibitPublicIpOnVnic?: boolean;
  vcnCidrBlock?: string;
  vcnIpv6CidrBlocks?: string[];
}

export interface InstancePollingMeta {
  isPolling: boolean;
  lastUpdatedAt?: string;
  pollingMessage?: string;
}

export interface LogItem {
  id: string;
  time: string;
  user: string;
  account: string;
  instance: string;
  action: string;
  result: "success" | "failed";
  message: string;
}

export interface DashboardData {
  accounts: AccountItem[];
  instances: InstanceItem[];
  logs: LogItem[];
}
