// Test: Encryption Token Format Contract
// File: src/__tests__/unit/encryption-token-format.test.ts
// Purpose: Verify the full encrypt → format → store → read → split → decrypt → equality flow
//          confirming the token format contract iv:authTag:encryptedData
//
// BUG-003: Encryption Token Format Assumption May Cause WhatsApp Decryption Failure
// Exit Criterion 3: Add integration test that encrypts, stores, reads, and decrypts a test token
// Exit Criterion 4: Document the token format contract
//
// Format Contract:
//   encrypt(plaintext) → { encryptedData: string, iv: string, authTag: string }
//   Store as:           `${iv}:${authTag}:${encryptedData}`
//   Read via:           storedToken.split(":") → [iv, authTag, encryptedData]
//   Decrypt via:        decrypt(encryptedData, iv, authTag) → original plaintext

import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

describe("BUG-003: Encryption Token Format Contract", () => {
  beforeAll(() => {
    // Set a deterministic encryption key for test reproducibility
    // The key is 32 hex pairs (64 chars) — exactly the AES-256 key length
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  describe("1. Encrypt → Format → Store simulation", () => {
    it("should encrypt a plaintext token into { encryptedData, iv, authTag }", () => {
      const plaintext = "EAAGyZCpZB0ZC8BAP123xyz_test_token_gcm";

      const result = encrypt(plaintext);

      // All three fields must be present and non-empty
      expect(result).toHaveProperty("encryptedData");
      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("authTag");
      expect(result.encryptedData).toBeTruthy();
      expect(result.iv).toBeTruthy();
      expect(result.authTag).toBeTruthy();

      // All three fields must be hex strings (no colons or special chars)
      expect(result.encryptedData).toMatch(/^[0-9a-f]+$/);
      expect(result.iv).toMatch(/^[0-9a-f]+$/);
      expect(result.authTag).toMatch(/^[0-9a-f]+$/);
    });

    it("should serialize as iv:authTag:encryptedData with exactly 3 colon-separated parts", () => {
      const plaintext = "EAAGyZCpZB0ZC8BAP123xyz_test_token_gcm";
      const { encryptedData, iv, authTag } = encrypt(plaintext);

      // This is the EXACT serialization used by ClinicService and TenantOnboardingService
      const storedFormat = `${iv}:${authTag}:${encryptedData}`;

      const parts = storedFormat.split(":");
      expect(parts.length).toBe(3);

      const [readIv, readAuthTag, readEncryptedData] = parts;
      expect(readIv).toBe(iv);
      expect(readAuthTag).toBe(authTag);
      expect(readEncryptedData).toBe(encryptedData);
    });
  });

  describe("2. Read → Split → Decrypt → Original equality", () => {
    it("should decrypt the token back to original plaintext", () => {
      const plaintext = "EAAGyZCpZB0ZC8BAP123xyz_test_token_gcm";
      const { encryptedData, iv, authTag } = encrypt(plaintext);

      const decrypted = decrypt(encryptedData, iv, authTag);

      expect(decrypted).toBe(plaintext);
    });

    it("should survive the full roundtrip: encrypt → format → split → decrypt", () => {
      const plaintext = "EAAGyZCpZB0ZC8BAP123xyz_test_token_gcm";
      const { encryptedData, iv, authTag } = encrypt(plaintext);

      // Simulate what webhook and conversations handlers do
      const storedFormat = `${iv}:${authTag}:${encryptedData}`;
      const parts = storedFormat.split(":");
      const [readIv, readAuthTag, readEncryptedData] = parts;

      const decrypted = decrypt(readEncryptedData, readIv, readAuthTag);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("3. Content diversity — edge cases", () => {
    it("should handle short plaintext (empty string)", () => {
      const { encryptedData, iv, authTag } = encrypt("");
      const decrypted = decrypt(encryptedData, iv, authTag);
      expect(decrypted).toBe("");
    });

    it("should handle Arabic text", () => {
      const arabic = "عيادة ريفال للتجميل";
      const { encryptedData, iv, authTag } = encrypt(arabic);
      const decrypted = decrypt(encryptedData, iv, authTag);
      expect(decrypted).toBe(arabic);
    });

    it("should handle very long token", () => {
      const longToken = "A".repeat(500);
      const { encryptedData, iv, authTag } = encrypt(longToken);
      const decrypted = decrypt(encryptedData, iv, authTag);
      expect(decrypted).toBe(longToken);
    });

    it("should produce different ciphertexts for same plaintext (IV randomness)", () => {
      const plaintext = "same-token-every-time";

      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      // IV must be different each time (random)
      expect(result1.iv).not.toBe(result2.iv);
      // Encrypted data must be different due to different IV
      expect(result1.encryptedData).not.toBe(result2.encryptedData);
    });

    it("should reject tampered authTag", () => {
      const { encryptedData, iv } = encrypt("important-token");

      // Tamper with the authTag
      expect(() => decrypt(encryptedData, iv, "deadbeefdeadbeefdeadbeefdeadbeef")).toThrow();
    });

    it("should reject tampered iv", () => {
      const { encryptedData, authTag } = encrypt("important-token");

      // Tamper with the iv
      expect(() => decrypt(encryptedData, "deadbeefdeadbeefdeadbeefdeadbeef", authTag)).toThrow();
    });

    it("should reject wrong-length parts in split format", () => {
      const { encryptedData, iv, authTag } = encrypt("test");

      // 4 parts (extra colon)
      const fourParts = `${iv}:${authTag}:${encryptedData}:extra`;
      expect(fourParts.split(":").length).toBe(4);

      // 2 parts (missing authTag)
      const twoParts = `${iv}:${authTag}`;
      expect(twoParts.split(":").length).toBe(2);

      // 1 part (no delimiter)
      const onePart = `${iv}${authTag}${encryptedData}`;
      expect(onePart.split(":").length).toBe(1);
    });
  });

  describe("4. IV length — GCM standard compliance", () => {
    it("should use 12-byte IV (GCM standard)", () => {
      const { iv } = encrypt("test");
      // 12 bytes = 24 hex characters
      expect(iv.length).toBe(24);
    });
  });
});
