export interface CreateAccountPayload {
  name: string;
  tenancy: string;
  userOcid: string;
  fingerprint: string;
  privateKey?: string;
  keyFilePath?: string;
  region: string;
  passphrase?: string;
  description?: string;
  isDefault?: boolean;
}


export interface UpdateAccountPayload extends CreateAccountPayload {
  accountId: string;
  isActive?: boolean;
}
