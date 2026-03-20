import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.APP_ENCRYPTION_KEY || "dev-only-openclaw-oci-panel-key-32b";
const KEY = crypto.createHash("sha256").update(SECRET).digest();

export function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload: string) {
  const parts = payload.split(":");
  const ivHex = parts[0];
  const tagHex = parts[1];
  const encryptedHex = parts.slice(2).join(":");

  if (!ivHex || !tagHex || encryptedHex === undefined) {
    throw new Error("无效的加密内容");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
