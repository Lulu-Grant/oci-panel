import { generateKeyPairSync } from "node:crypto";

function encodeSshString(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(buffer.length, 0);
  return Buffer.concat([len, buffer]);
}

function toOpenSshEd25519PublicKey(rawPublicKey: Buffer) {
  const keyType = "ssh-ed25519";
  const payload = Buffer.concat([
    encodeSshString(keyType),
    encodeSshString(rawPublicKey),
  ]);
  return `${keyType} ${payload.toString("base64")}`;
}

export async function POST() {
  try {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");

    const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" });
    const publicKeyDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const rawEd25519PublicKey = publicKeyDer.subarray(-32);
    const publicKeyOpenSsh = toOpenSshEd25519PublicKey(rawEd25519PublicKey);

    return Response.json({
      success: true,
      publicKey: publicKeyOpenSsh,
      privateKey: typeof privateKeyPem === "string" ? privateKeyPem : privateKeyPem.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成 SSH key 失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
