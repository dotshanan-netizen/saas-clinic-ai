import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12; // GCM Standard

/**
 * Encrypts a string using AES-256-GCM
 * @param text Plain text to encrypt
 * @returns Object containing encrypted data, IV, and Authentication Tag
 */
export function encrypt(text: string): { encryptedData: string; iv: string; authTag: string } {
  const secretKey = process.env.ENCRYPTION_KEY || "rival_secret_default_key_32_bytes_len";
  
  let key: Buffer;
  if (secretKey.length === KEY_LEN * 2) {
    // Hex key
    key = Buffer.from(secretKey, "hex");
  } else {
    // Generate a secure 32-byte key from whatever string is provided
    key = crypto.createHash("sha256").update(secretKey).digest();
  }

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag,
  };
}

/**
 * Decrypts a cipher text using AES-256-GCM
 * @param encryptedData Hex string of encrypted data
 * @param ivHex Hex string of Initialization Vector
 * @param authTagHex Hex string of Authentication Tag
 * @returns Decrypted plain text string
 */
export function decrypt(encryptedData: string, ivHex: string, authTagHex: string): string {
  const secretKey = process.env.ENCRYPTION_KEY || "rival_secret_default_key_32_bytes_len";

  let key: Buffer;
  if (secretKey.length === KEY_LEN * 2) {
    key = Buffer.from(secretKey, "hex");
  } else {
    key = crypto.createHash("sha256").update(secretKey).digest();
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
const encryption = { encrypt, decrypt };
export default encryption;
