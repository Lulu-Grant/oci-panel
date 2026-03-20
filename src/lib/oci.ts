import { promises as fs } from "node:fs";
import path from "node:path";
import oci from "oci-sdk";
import { StoredOracleAccount } from "@/lib/accounts-store";

export async function resolvePrivateKey(account: StoredOracleAccount): Promise<string> {
  if (account.privateKey && account.privateKey.trim()) {
    return account.privateKey;
  }

  if (account.keyFilePath && account.keyFilePath.trim()) {
    const fullPath = path.resolve(account.keyFilePath);
    return await fs.readFile(fullPath, "utf8");
  }

  throw new Error("未找到可用私钥，请提供 privateKey 或 keyFilePath");
}

function resolveRegion(regionId: string) {
  return oci.common.Region.fromRegionId(regionId);
}

function createProvider(account: StoredOracleAccount, privateKey: string) {
  return new oci.SimpleAuthenticationDetailsProvider(
    account.tenancy,
    account.userOcid,
    account.fingerprint,
    privateKey,
    account.passphrase || null,
    resolveRegion(account.region)
  );
}

export async function createIdentityClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.identity.IdentityClient({ authenticationDetailsProvider: provider });
}

export async function createComputeClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.core.ComputeClient({ authenticationDetailsProvider: provider });
}

export async function createVirtualNetworkClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
}

export async function createLimitsClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.limits.LimitsClient({ authenticationDetailsProvider: provider });
}

export async function createBlockstorageClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.core.BlockstorageClient({ authenticationDetailsProvider: provider });
}

export async function createOsManagementHubManagedInstanceClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.osmanagementhub.ManagedInstanceClient({ authenticationDetailsProvider: provider });
}

export async function createOsManagementHubScheduledJobClient(account: StoredOracleAccount) {
  const privateKey = await resolvePrivateKey(account);
  const provider = createProvider(account, privateKey);
  return new oci.osmanagementhub.ScheduledJobClient({ authenticationDetailsProvider: provider });
}
